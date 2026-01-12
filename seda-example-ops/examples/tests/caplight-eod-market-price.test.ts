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

const WASM_PATH = 'target/wasm32-wasip1/release/caplight-eod-market-price.wasm';

const fetchMock = mock();

afterEach(() => {
  fetchMock.mockRestore();
});

describe('caplight eod market price', () => {
  describe('execution phase', () => {
    it('works', async () => {
      fetchMock.mockImplementation((_) => {
        return new Response(
          JSON.stringify({
            date: '2022-09-10',
            price: 15.9,
            estimatedValuation: 2150000000,
            priceStandardError: 1.35,
            generatedAtTimestamp: 1690000000,
            daysSinceLastDataPoint: 10,
            numberOfPoints6mo: 12,
            orderImbalance: {
              bidContribution: 0.53,
              offerContribution: 0.25,
            },
          }),
        );
      });

      const oracleProgram = await file(WASM_PATH).arrayBuffer();

      const vmResult = await testOracleProgramExecution(
        Buffer.from(oracleProgram),
        Buffer.from('BTC-USDT'),
        fetchMock,
        undefined,
        undefined,
        undefined,
        0n,
      );

      handleExecutionVmResult(vmResult, 0, 1590n);
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
