import { afterEach, describe, it, expect, mock } from "bun:test";
import { file } from "bun";
import { testOracleProgramExecution, testOracleProgramTally } from "@seda-protocol/dev-tools";

const WASM_PATH =
  "oracle-program/target/wasm32-wasip1/release-wasm/vvs-wcro-usdc-oracle.wasm";

const fetchMock = mock();

afterEach(() => {
  fetchMock.mockRestore();
});

describe("data request execution", () => {
  it("should return an int256[4] array for WCRO-USDC", async () => {
    fetchMock.mockImplementation((_url, options) => {
      const body = options?.body ? JSON.parse(options.body.toString()) : {};
      const method = body.method;
      const params = body.params ?? [];

      if (method === "eth_blockNumber") {
        return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x2710" }));
      }

      if (method === "eth_getBlockByNumber") {
        const blockHex = params[0] as string;
        const blockNumber = parseInt(blockHex.replace("0x", ""), 16);
        const timestamp = blockNumber * 10;
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: { timestamp: `0x${timestamp.toString(16)}` },
          })
        );
      }

      if (method === "eth_call") {
        const call = params[0] ?? {};
        const data = (call.data as string) ?? "";
        if (data.toLowerCase() === "0x0dfe1681") {
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              result:
                "0x0000000000000000000000005c7f8a570d578ed84e63fdfa7b1ee72deae1ae23",
            })
          );
        }
        if (data.toLowerCase() === "0x0902f1ac") {
          const reserve0 = toHex32(1_000_000_000_000_000_000n);
          const reserve1 = toHex32(1_000_000_000_000n);
          const timestamp = toHex32(100_000n);
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              result: `0x${reserve0}${reserve1}${timestamp}`,
            })
          );
        }
      }

      return new Response(
        JSON.stringify({ jsonrpc: "2.0", id: 1, error: { message: "Unknown request" } })
      );
    });

    const oracleProgram = await file(WASM_PATH).arrayBuffer();

    const vmResult = await testOracleProgramExecution(
      Buffer.from(oracleProgram),
      Buffer.from('{"pair":"WCRO-USDC"}'),
      fetchMock
    );

    expect(vmResult.exitCode).toBe(0);
    const values = decodeInt256ArrayAbi(vmResult.result);
    const expectedMaxSize = maxSafeExecutionSize(
      1_000_000_000_000n,
      1_000_000_000_000_000_000n,
      1_000_000_000_000n
    );
    expect(values).toEqual([1_000_000_000_000n, 1_000_000n, expectedMaxSize, 0n]);
  });

  it('should tally all results in a single data point', async () => {
    const oracleProgram = await file(WASM_PATH).arrayBuffer();

    const expectedMaxSize = maxSafeExecutionSize(
      1_000_000_000_000n,
      1_000_000_000_000_000_000n,
      1_000_000_000_000n
    );
    const buffer = encodeInt256ArrayAbi([
      1_000_000n,
      1_000_000n,
      expectedMaxSize,
      0n,
    ]);
    const vmResult = await testOracleProgramTally(Buffer.from(oracleProgram), Buffer.from('tally-inputs'), [{
      exitCode: 0,
      gasUsed: 0,
      inConsensus: true,
      result: buffer,
    }]);

    expect(vmResult.exitCode).toBe(0);
    const values = decodeInt256ArrayAbi(vmResult.result);
    expect(values).toEqual([1_000_000n, 1_000_000n, expectedMaxSize, 0n]);
  });
});

function toHex32(value: bigint): string {
  return value.toString(16).padStart(64, "0");
}

function encodeInt256ArrayAbi(values: bigint[]): Buffer {
  const offset = toHex32(32n);
  const length = toHex32(BigInt(values.length));
  const items = values.map((value) => {
    const asUint = value < 0n ? (1n << 256n) + value : value;
    return toHex32(asUint);
  });
  return Buffer.from(`${offset}${length}${items.join("")}`, "hex");
}

function decodeInt256ArrayAbi(bytes: Uint8Array): bigint[] {
  const hex = Buffer.from(bytes).toString("hex");
  const words = hex.match(/.{1,64}/g) ?? [];
  if (words.length < 2) {
    throw new Error("Invalid ABI payload");
  }
  const offset = parseInt(words[0], 16) / 32;
  const length = parseInt(words[offset], 16);
  const result: bigint[] = [];
  for (let i = 0; i < length; i += 1) {
    const raw = words[offset + 1 + i];
    const value = BigInt(`0x${raw}`);
    const signBit = 1n << 255n;
    const signed = value & signBit ? value - (1n << 256n) : value;
    result.push(signed);
  }
  return result;
}

function maxSafeExecutionSize(
  reserveIn: bigint,
  reserveOut: bigint,
  spot1e6: bigint
): bigint {
  let low = 0n;
  let high = reserveIn / 2n;
  let best = 0n;

  for (let i = 0; i < 28; i += 1) {
    const mid = (low + high) / 2n;
    if (mid === 0n) break;
    const amountOut = ammAmountOut(mid, reserveIn, reserveOut);
    if (amountOut === 0n) {
      high = mid - 1n;
      continue;
    }
    const effectivePrice = (mid * 1_000_000_000_000_000_000n) / amountOut;
    const slippage = (absDiff(effectivePrice, spot1e6) * 1_000_000n) / spot1e6;
    if (slippage < 10_000n) {
      best = mid;
      low = mid + 1n;
    } else {
      high = mid - 1n;
    }
  }

  return best;
}

function ammAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  const amountInWithFee = amountIn * 997n;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 1000n + amountInWithFee;
  if (denominator === 0n) return 0n;
  return numerator / denominator;
}

function absDiff(a: bigint, b: bigint): bigint {
  return a >= b ? a - b : b - a;
}
