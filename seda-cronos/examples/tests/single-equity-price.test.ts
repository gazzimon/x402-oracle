// biome-ignore assist/source/organizeImports: biome is lying
import { file } from 'bun';
import { afterEach, describe, it, mock } from 'bun:test';
import { testOracleProgramExecution, testOracleProgramTally } from '@seda-protocol/dev-tools';
import {
  handleBigIntTallyVmResult as handleVmResult,
  handleBigIntExecutionVmResult as handleExecutionVmResult,
  createRevealArray,
  RevealKind,
} from './utils.js';

const WASM_PATH = 'target/wasm32-wasip1/release/single-equity-price.wasm';

const fetchMock = mock();

afterEach(() => {
  fetchMock.mockRestore();
});

describe('single equity price', () => {
  describe('execution phase', () => {
    it('works', async () => {
      fetchMock.mockImplementation((_) => {
        return new Response(
          JSON.stringify({
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
          }),
        );
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

      handleExecutionVmResult(vmResult, 0, 21444n);
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
      handleVmResult(vmResult, 0, 100n);
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
      handleVmResult(vmResult, 0, 150n);
    });

    it('works with 5 prices', async () => {
      const oracleProgram = await file(WASM_PATH).arrayBuffer();
      const vmResult = await testOracleProgramTally(
        Buffer.from(oracleProgram),
        Buffer.from('tally-inputs'),
        createRevealArray([
          [RevealKind.BigInt, 100n],
          [RevealKind.BigInt, 200n],
          [RevealKind.BigInt, 300n],
          [RevealKind.BigInt, 400n],
          [RevealKind.BigInt, 500n],
        ]),
      );
      handleVmResult(vmResult, 0, 300n);
    });

    it('works with 10 prices', async () => {
      const oracleProgram = await file(WASM_PATH).arrayBuffer();
      const vmResult = await testOracleProgramTally(
        Buffer.from(oracleProgram),
        Buffer.from('tally-inputs'),
        createRevealArray([
          [RevealKind.BigInt, 100n],
          [RevealKind.BigInt, 200n],
          [RevealKind.BigInt, 300n],
          [RevealKind.BigInt, 400n],
          [RevealKind.BigInt, 500n],
          [RevealKind.BigInt, 600n],
          [RevealKind.BigInt, 700n],
          [RevealKind.BigInt, 800n],
          [RevealKind.BigInt, 900n],
          [RevealKind.BigInt, 1000n],
        ]),
      );
      handleVmResult(vmResult, 0, 550n);
    });

    it('works with unsorted prices', async () => {
      const oracleProgram = await file(WASM_PATH).arrayBuffer();
      const vmResult = await testOracleProgramTally(
        Buffer.from(oracleProgram),
        Buffer.from('tally-inputs'),
        createRevealArray([
          [RevealKind.BigInt, 500n],
          [RevealKind.BigInt, 100n],
          [RevealKind.BigInt, 300n],
          [RevealKind.BigInt, 200n],
          [RevealKind.BigInt, 200n],
          [RevealKind.BigInt, 400n],
        ]),
      );
      handleVmResult(vmResult, 0, 250n);
    });

    describe('works with errored executions', () => {
      it('should ignore the errored execution', async () => {
        const oracleProgram = await file(WASM_PATH).arrayBuffer();

        const vmResult = await testOracleProgramTally(
          Buffer.from(oracleProgram),
          Buffer.from('tally-inputs'),
          createRevealArray([[RevealKind.BigInt, 100n], [RevealKind.Failed], [RevealKind.BigInt, 200n]]),
        );

        handleVmResult(vmResult, 0, 150n);
      });

      it('should ignore multiple errored executions', async () => {
        const oracleProgram = await file(WASM_PATH).arrayBuffer();

        const vmResult = await testOracleProgramTally(
          Buffer.from(oracleProgram),
          Buffer.from('tally-inputs'),
          createRevealArray([
            [RevealKind.BigInt, 100n],
            [RevealKind.Failed],
            [RevealKind.BigInt, 200n],
            [RevealKind.Failed],
            [RevealKind.BigInt, 300n],
          ]),
        );

        handleVmResult(vmResult, 0, 200n);
      });

      it('should error if all executions errored', async () => {
        const oracleProgram = await file(WASM_PATH).arrayBuffer();
        const vmResult = await testOracleProgramTally(
          Buffer.from(oracleProgram),
          Buffer.from('tally-inputs'),
          createRevealArray([[RevealKind.Failed], [RevealKind.Failed], [RevealKind.Failed]]),
        );

        handleVmResult(vmResult, 1, 0n);
      });
    });
  });
});
