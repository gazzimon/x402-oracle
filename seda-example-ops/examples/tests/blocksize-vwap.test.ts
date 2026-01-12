// biome-ignore assist/source/organizeImports: biome is lying
import { file } from 'bun';
import { afterEach, describe, it, mock } from 'bun:test';
import { testOracleProgramExecution, testOracleProgramTally } from '@seda-protocol/dev-tools';
import {
  handleBigIntArrayTallyVmResult as handleVmResult,
  handleBigIntArrayExecutionVmResult as handleExecutionVmResult,
  createRevealArray,
  RevealKind,
} from './utils.js';

const WASM_PATH = 'target/wasm32-wasip1/release/blocksize-vwap.wasm';

const fetchMock = mock();

afterEach(() => {
  fetchMock.mockRestore();
});

describe('blocksize vwap', () => {
  describe('execution phase', () => {
    it('works', async () => {
      fetchMock.mockImplementation((_) => {
        return new Response(
          JSON.stringify({
            ticker: 'BTCUSD',
            price: 112269.91858575967,
            size: 4.5646076099999995,
            volume: 512468.12475063896,
            ts: 1756147348689,
          }),
        );
      });

      const oracleProgram = await file(WASM_PATH).arrayBuffer();

      const vmResult = await testOracleProgramExecution(
        Buffer.from(oracleProgram),
        Buffer.from('BTCUSD'),
        fetchMock,
        undefined,
        undefined,
        undefined,
        0n,
      );
      console.log('VM Result:', vmResult);

      handleExecutionVmResult(vmResult, 0, [112269918585n, 4564607n, 512468124750n, 1756147348689n]);
    });

    it('works with a singular specified field', async () => {
      fetchMock.mockImplementation((_) => {
        return new Response(
          JSON.stringify({
            ticker: 'BTCUSD',
            price: 112269.91858575967,
            size: 4.5646076099999995,
            volume: 512468.12475063896,
            ts: 1756147348689,
          }),
        );
      });

      const oracleProgram = await file(WASM_PATH).arrayBuffer();

      const vmResult = await testOracleProgramExecution(
        Buffer.from(oracleProgram),
        Buffer.from('BTCUSD-size'),
        fetchMock,
        undefined,
        undefined,
        undefined,
        0n,
      );

      handleExecutionVmResult(vmResult, 0, [4564607n]);
    });

    it('works with a multi specified field and returns in the specified order', async () => {
      fetchMock.mockImplementation((_) => {
        return new Response(
          JSON.stringify({
            ticker: 'BTCUSD',
            price: 112269.91858575967,
            size: 4.5646076099999995,
            volume: 512468.12475063896,
            ts: 1756147348689,
          }),
        );
      });

      const oracleProgram = await file(WASM_PATH).arrayBuffer();

      const vmResult = await testOracleProgramExecution(
        Buffer.from(oracleProgram),
        Buffer.from('BTCUSD-ts,price'),
        fetchMock,
        undefined,
        undefined,
        undefined,
        0n,
      );

      handleExecutionVmResult(vmResult, 0, [1756147348689n, 112269918585n]);
    });

    it('ignores if a non-existent field is requested', async () => {
      fetchMock.mockImplementation((_) => {
        return new Response(
          JSON.stringify({
            ticker: 'BTCUSD',
            price: 112269.91858575967,
            size: 4.5646076099999995,
            volume: 512468.12475063896,
            ts: 1756147348689,
          }),
        );
      });

      const oracleProgram = await file(WASM_PATH).arrayBuffer();

      const vmResult = await testOracleProgramExecution(
        Buffer.from(oracleProgram),
        Buffer.from('BTCUSD-does_not_exist,price'),
        fetchMock,
        undefined,
        undefined,
        undefined,
        0n,
      );
      console.log('VM Result:', vmResult);

      handleExecutionVmResult(vmResult, 0, [112269918585n]);
    });

    it('errors if no valid fields are selected', async () => {
      fetchMock.mockImplementation((_) => {
        return new Response(
          JSON.stringify({
            ticker: 'BTCUSD',
            price: 112269.91858575967,
            size: 4.5646076099999995,
            volume: 512468.12475063896,
            ts: 1756147348689,
          }),
        );
      });

      const oracleProgram = await file(WASM_PATH).arrayBuffer();

      const vmResult = await testOracleProgramExecution(
        Buffer.from(oracleProgram),
        Buffer.from('BTCUSD-does_not_exist'),
        fetchMock,
        undefined,
        undefined,
        undefined,
        0n,
      );

      handleExecutionVmResult(vmResult, 1, []);
    });
  });

  describe('tally phase', () => {
    it('works with 1 price', async () => {
      const oracleProgram = await file(WASM_PATH).arrayBuffer();
      const vmResult = await testOracleProgramTally(
        Buffer.from(oracleProgram),
        Buffer.from('tally-inputs'),
        createRevealArray([[RevealKind.BigIntArray, [100n]]]),
      );
      handleVmResult(vmResult, 0, [100n]);
    });

    it('works with 1 price and multiple fields', async () => {
      const oracleProgram = await file(WASM_PATH).arrayBuffer();
      const vmResult = await testOracleProgramTally(
        Buffer.from(oracleProgram),
        Buffer.from('tally-inputs'),
        createRevealArray([
          [RevealKind.BigIntArray, [100n]],
          [RevealKind.BigIntArray, [200n]],
        ]),
      );
      handleVmResult(vmResult, 0, [150n]);
    });

    it('works with 2 prices', async () => {
      const oracleProgram = await file(WASM_PATH).arrayBuffer();
      const vmResult = await testOracleProgramTally(
        Buffer.from(oracleProgram),
        Buffer.from('tally-inputs'),
        createRevealArray([
          [RevealKind.BigIntArray, [100n]],
          [RevealKind.BigIntArray, [200n]],
        ]),
      );
      handleVmResult(vmResult, 0, [150n]);
    });

    it('works with 2 prices with multiple fields', async () => {
      const oracleProgram = await file(WASM_PATH).arrayBuffer();
      const vmResult = await testOracleProgramTally(
        Buffer.from(oracleProgram),
        Buffer.from('tally-inputs'),
        createRevealArray([
          [RevealKind.BigIntArray, [100n, 500n]],
          [RevealKind.BigIntArray, [300n, 900n]],
          [RevealKind.BigIntArray, [200n, 700n]],
        ]),
      );
      handleVmResult(vmResult, 0, [200n, 700n]);
    });

    it('works with 5 prices', async () => {
      const oracleProgram = await file(WASM_PATH).arrayBuffer();
      const vmResult = await testOracleProgramTally(
        Buffer.from(oracleProgram),
        Buffer.from('tally-inputs'),
        createRevealArray([
          [RevealKind.BigIntArray, [100n]],
          [RevealKind.BigIntArray, [200n]],
          [RevealKind.BigIntArray, [300n]],
          [RevealKind.BigIntArray, [400n]],
          [RevealKind.BigIntArray, [500n]],
        ]),
      );
      handleVmResult(vmResult, 0, [300n]);
    });

    it('works with 10 prices', async () => {
      const oracleProgram = await file(WASM_PATH).arrayBuffer();
      const vmResult = await testOracleProgramTally(
        Buffer.from(oracleProgram),
        Buffer.from('tally-inputs'),
        createRevealArray([
          [RevealKind.BigIntArray, [100n]],
          [RevealKind.BigIntArray, [200n]],
          [RevealKind.BigIntArray, [300n]],
          [RevealKind.BigIntArray, [400n]],
          [RevealKind.BigIntArray, [500n]],
          [RevealKind.BigIntArray, [600n]],
          [RevealKind.BigIntArray, [700n]],
          [RevealKind.BigIntArray, [800n]],
          [RevealKind.BigIntArray, [900n]],
          [RevealKind.BigIntArray, [1000n]],
        ]),
      );
      handleVmResult(vmResult, 0, [550n]);
    });

    it('works with unsorted prices', async () => {
      const oracleProgram = await file(WASM_PATH).arrayBuffer();
      const vmResult = await testOracleProgramTally(
        Buffer.from(oracleProgram),
        Buffer.from('tally-inputs'),
        createRevealArray([
          [RevealKind.BigIntArray, [500n]],
          [RevealKind.BigIntArray, [100n]],
          [RevealKind.BigIntArray, [300n]],
          [RevealKind.BigIntArray, [200n]],
          [RevealKind.BigIntArray, [200n]],
          [RevealKind.BigIntArray, [400n]],
        ]),
      );
      handleVmResult(vmResult, 0, [250n]);
    });

    describe('works with errored executions', () => {
      it('should ignore the errored execution', async () => {
        const oracleProgram = await file(WASM_PATH).arrayBuffer();

        const vmResult = await testOracleProgramTally(
          Buffer.from(oracleProgram),
          Buffer.from('tally-inputs'),
          createRevealArray([[RevealKind.BigIntArray, [100n]], [RevealKind.Failed], [RevealKind.BigIntArray, [200n]]]),
        );

        handleVmResult(vmResult, 0, [150n]);
      });

      it('should ignore multiple errored executions', async () => {
        const oracleProgram = await file(WASM_PATH).arrayBuffer();

        const vmResult = await testOracleProgramTally(
          Buffer.from(oracleProgram),
          Buffer.from('tally-inputs'),
          createRevealArray([
            [RevealKind.BigIntArray, [100n]],
            [RevealKind.Failed],
            [RevealKind.BigIntArray, [200n]],
            [RevealKind.Failed],
            [RevealKind.BigIntArray, [300n]],
          ]),
        );

        handleVmResult(vmResult, 0, [200n]);
      });

      it('should error if all executions errored', async () => {
        const oracleProgram = await file(WASM_PATH).arrayBuffer();
        const vmResult = await testOracleProgramTally(
          Buffer.from(oracleProgram),
          Buffer.from('tally-inputs'),
          createRevealArray([[RevealKind.Failed], [RevealKind.Failed], [RevealKind.Failed]]),
        );

        handleVmResult(vmResult, 1, []);
      });
    });
  });
});
