// biome-ignore assist/source/organizeImports: biome is lying
import { file } from 'bun';
import { afterEach, describe, it, mock } from 'bun:test';
import { testOracleProgramExecution, testOracleProgramTally } from '@seda-protocol/dev-tools';
import {
  handleInt256ArrayTallyVmResult as handleVmResult,
  handleBigIntExecutionVmResult as handleExecutionVmResult,
  createRevealArray,
  RevealKind,
} from './utils.js';

const WASM_PATH = 'target/wasm32-wasip1/release/single-price-feed-verification.wasm';

const fetchMock = mock();

afterEach(() => {
  fetchMock.mockRestore();
});

describe('single price feed verification', () => {
  describe('execution phase', () => {
    it('works', async () => {
      const responseBody = {
        btc: { usd: 121239 },
      };
      fetchMock.mockImplementation(() => {
        return new Response(JSON.stringify(responseBody));
      });

      const oracleProgram = await file(WASM_PATH).arrayBuffer();
      const vmResult = await testOracleProgramExecution(
        Buffer.from(oracleProgram),
        Buffer.from('BTC'),
        fetchMock,
        undefined,
        undefined,
        undefined,
        0n,
      );

      handleExecutionVmResult(vmResult, 0, 121239000000n);
    });
  });

  describe('tally phase', () => {
    it('works', async () => {
      const oracleProgram = await file(WASM_PATH).arrayBuffer();
      const vmResult = await testOracleProgramTally(
        Buffer.from(oracleProgram),
        Buffer.from('tally-inputs'),
        createRevealArray([[RevealKind.BigInt, 113301000000n]]),
      );

      handleVmResult(vmResult, 0, [113301000000n]);
    });

    describe('works with errored executions', () => {
      it('should error if all executions errored', async () => {
        const oracleProgram = await file(WASM_PATH).arrayBuffer();
        const vmResult = await testOracleProgramTally(
          Buffer.from(oracleProgram),
          Buffer.from('tally-inputs'),
          createRevealArray([[RevealKind.Failed]]),
        );

        handleVmResult(vmResult, 1, [0n]);
      });
    });
  });
});
