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

const WASM_PATH = 'target/wasm32-wasip1/release/single-equity-price-verification.wasm';

const fetchMock = mock();

afterEach(() => {
  fetchMock.mockRestore();
});

describe('single equity price verification', () => {
  describe('execution phase', () => {
    it('works', async () => {
      const responseBody = {
        Quote: {
          'AAPL:USLF24': {
            askExchangeCode: 'U',
            askPrice: 214.44,
            askSize: 123,
            askTime: 1753707742000,
            bidExchangeCode: 'U',
            bidPrice: 214.2,
            bidSize: 157,
            bidTime: 1753707657000,
            eventSymbol: 'AAPL:USLF24',
            eventTime: 0,
            sequence: 0,
            timeNanoPart: 0,
          },
        },
        status: 'OK',
      };
      fetchMock.mockImplementation(() => {
        return new Response(JSON.stringify(responseBody));
      });

      const oracleProgram = await file(WASM_PATH).arrayBuffer();
      const vmResult = await testOracleProgramExecution(
        Buffer.from(oracleProgram),
        Buffer.from('AAPL'),
        fetchMock,
        undefined,
        undefined,
        undefined,
        0n,
      );

      handleExecutionVmResult(vmResult, 0, 214440000n);
    });
  });

  describe('tally phase', () => {
    it('works', async () => {
      const oracleProgram = await file(WASM_PATH).arrayBuffer();
      const vmResult = await testOracleProgramTally(
        Buffer.from(oracleProgram),
        Buffer.from('tally-inputs'),
        createRevealArray([[RevealKind.BigInt, 214440000n]]),
      );

      handleVmResult(vmResult, 0, [214440000n]);
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
