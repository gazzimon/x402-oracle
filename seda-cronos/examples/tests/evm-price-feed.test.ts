// biome-ignore assist/source/organizeImports: biome is lying
import { file } from 'bun';
import { afterEach, describe, expect, it, mock } from 'bun:test';
import { testOracleProgramExecution, testOracleProgramTally } from '@seda-protocol/dev-tools';
import {
  handleBigIntExecutionVmResult as handleExecutionVmResult,
  handleInt256ArrayTallyVmResult as handleTallyVmResult,
  createRevealArray,
  RevealKind,
} from './utils.js';
import { ethers } from 'ethers';

const WASM_PATH = 'target/wasm32-wasip1/release/evm-price-feed.wasm';
const RPC_HOST = 'mainnet-sticky.cronoslabs.com';
const SELECTOR_GET_RESERVES = '0x0902f1ac';
const SELECTOR_TOKEN0 = '0x0dfe1681';

const fetchMock = mock();

afterEach(() => {
  fetchMock.mockRestore();
});

describe('evm price feed (on-chain VVS)', () => {
  describe('execution phase', () => {
    it('returns a scaled price for WCRO-USDC', async () => {
      const reserve0 = 1_000_000_000_000_000_000n;
      const reserve1 = 1_000_000n;
      const reservesEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint112', 'uint112', 'uint32'],
        [reserve0, reserve1, 0],
      );
      const token0Encoded = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address'],
        ['0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23'],
      );

      fetchMock.mockImplementation((url, options) => {
        if (url.host !== RPC_HOST) {
          throw new Error(`Unexpected host: ${url.host}`);
        }
        const body = JSON.parse(Buffer.from(options?.body ?? []).toString('utf8'));
        const data = body?.params?.[0]?.data ?? '';
        if (data === SELECTOR_GET_RESERVES) {
          return new Response(JSON.stringify({ result: reservesEncoded }));
        }
        if (data === SELECTOR_TOKEN0) {
          return new Response(JSON.stringify({ result: token0Encoded }));
        }
        return new Response(JSON.stringify({ error: 'Unknown selector' }), { status: 400 });
      });

      const oracleProgram = await file(WASM_PATH).arrayBuffer();
      const vmResult = await testOracleProgramExecution(
        Buffer.from(oracleProgram),
        Buffer.from('WCRO-USDC'),
        fetchMock,
      );

      handleExecutionVmResult(vmResult, 0, 1_000_000n);
    });

    it('rejects unsupported pairs', async () => {
      const oracleProgram = await file(WASM_PATH).arrayBuffer();
      const vmResult = await testOracleProgramExecution(
        Buffer.from(oracleProgram),
        Buffer.from('BAD-PAIR'),
        fetchMock,
      );
      expect(vmResult.exitCode).toBe(1);
    });
  });

  describe('tally phase', () => {
    it('works with 1 price', async () => {
      const oracleProgram = await file(WASM_PATH).arrayBuffer();
      const vmResult = await testOracleProgramTally(
        Buffer.from(oracleProgram),
        Buffer.from('tally-inputs'),
        createRevealArray([[RevealKind.BigInt, 100n]]),
      );
      handleTallyVmResult(vmResult, 0, [100n]);
    });

    it('works with 2 prices', async () => {
      const oracleProgram = await file(WASM_PATH).arrayBuffer();
      const vmResult = await testOracleProgramTally(
        Buffer.from(oracleProgram),
        Buffer.from('tally-inputs'),
        createRevealArray([
          [RevealKind.BigInt, 100n],
          [RevealKind.BigInt, 200n],
        ]),
      );
      handleTallyVmResult(vmResult, 0, [150n]);
    });
  });
});
