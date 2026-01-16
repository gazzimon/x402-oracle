// biome-ignore assist/source/organizeImports: biome is lying
import { file } from 'bun';
import { afterEach, describe, it, mock, test } from 'bun:test';
import { testOracleProgramExecution, testOracleProgramTally } from '@seda-protocol/dev-tools';
import {
  handleBigIntArrayTallyVmResult as handleVmResult,
  handleJsonArrayBigIntExecutionVmResult as handleExecutionVmResult,
  createRevealArray,
  RevealKind,
} from './utils.js';

const WASM_PATH = 'target/wasm32-wasip1/release/single-price-feed.wasm';

const fetchMock = mock();

afterEach(() => {
  fetchMock.mockRestore();
});

describe('single price feed', () => {
  describe('execution phase', () => {
    it('works', async () => {
      fetchMock.mockImplementation((_) => {
        return new Response(JSON.stringify({ bitcoin: { usd: 121239 }, ethereum: { usd: 4658.03 } }));
      });

      const oracleProgram = await file(WASM_PATH).arrayBuffer();

      const vmResult = await testOracleProgramExecution(
        Buffer.from(oracleProgram),
        Buffer.from('BTC,ETH'),
        fetchMock,
        undefined,
        undefined,
        undefined,
        0n,
      );

      handleExecutionVmResult(vmResult, 0, [121239000000n, 4658030000n]);
    });
  });

  describe('tally phase', () => {
    describe('works with 1 price', () => {
      const cases = [
        {
          inputs: createRevealArray([[RevealKind.JsonBigIntArray, [100n]]]),
          expected: [100n],
        },
        {
          inputs: createRevealArray([
            [RevealKind.JsonBigIntArray, [100n]],
            [RevealKind.JsonBigIntArray, [200n]],
          ]),
          expected: [150n],
        },
        {
          inputs: createRevealArray([
            [RevealKind.JsonBigIntArray, [200n]],
            [RevealKind.JsonBigIntArray, [100n]],
          ]),
          expected: [150n],
        },
        {
          inputs: createRevealArray([
            [RevealKind.JsonBigIntArray, [100n]],
            [RevealKind.JsonBigIntArray, [200n]],
            [RevealKind.JsonBigIntArray, [300n]],
            [RevealKind.JsonBigIntArray, [400n]],
            [RevealKind.JsonBigIntArray, [500n]],
            [RevealKind.JsonBigIntArray, [600n]],
            [RevealKind.JsonBigIntArray, [700n]],
            [RevealKind.JsonBigIntArray, [800n]],
            [RevealKind.JsonBigIntArray, [900n]],
          ]),
          expected: [500n],
        },
        {
          inputs: createRevealArray([
            [RevealKind.JsonBigIntArray, [100n]],
            [RevealKind.JsonBigIntArray, [200n]],
            [RevealKind.JsonBigIntArray, [300n]],
            [RevealKind.JsonBigIntArray, [400n]],
            [RevealKind.JsonBigIntArray, [500n]],
            [RevealKind.JsonBigIntArray, [600n]],
            [RevealKind.JsonBigIntArray, [700n]],
            [RevealKind.JsonBigIntArray, [800n]],
            [RevealKind.JsonBigIntArray, [900n]],
            [RevealKind.JsonBigIntArray, [1000n]],
          ]),
          expected: [550n],
        },
      ];

      cases.forEach(({ inputs, expected }) => {
        test(`with ${inputs.length} reveals`, async () => {
          const oracleProgram = await file(WASM_PATH).arrayBuffer();

          const vmResult = await testOracleProgramTally(
            Buffer.from(oracleProgram),
            Buffer.from('tally-inputs'),
            inputs,
          );

          handleVmResult(vmResult, 0, expected);
        });
      });
    });

    describe('works with 5 prices', () => {
      const cases = [
        {
          inputs: createRevealArray([[RevealKind.JsonBigIntArray, [100n, 200n, 300n, 400n, 500n]]]),
          expected: [100n, 200n, 300n, 400n, 500n],
        },
        {
          inputs: createRevealArray([[RevealKind.JsonBigIntArray, [100n, 200n, 300n, 400n, 500n]]]),
          expected: [100n, 200n, 300n, 400n, 500n],
        },
        {
          inputs: createRevealArray([
            [RevealKind.JsonBigIntArray, [100n, 200n, 300n, 400n, 500n]],
            [RevealKind.JsonBigIntArray, [200n, 300n, 400n, 500n, 600n]],
          ]),
          expected: [150n, 250n, 350n, 450n, 550n],
        },
        {
          inputs: createRevealArray([
            [RevealKind.JsonBigIntArray, [100n, 200n, 300n, 400n, 500n]],
            [RevealKind.JsonBigIntArray, [200n, 300n, 400n, 500n, 600n]],
            [RevealKind.JsonBigIntArray, [300n, 400n, 500n, 600n, 700n]],
            [RevealKind.JsonBigIntArray, [400n, 500n, 600n, 700n, 800n]],
            [RevealKind.JsonBigIntArray, [500n, 600n, 700n, 800n, 900n]],
          ]),
          expected: [300n, 400n, 500n, 600n, 700n],
        },
        {
          inputs: createRevealArray([
            [RevealKind.JsonBigIntArray, [100n, 200n, 300n, 400n, 500n]],
            [RevealKind.JsonBigIntArray, [200n, 300n, 400n, 500n, 600n]],
            [RevealKind.JsonBigIntArray, [300n, 400n, 500n, 600n, 700n]],
            [RevealKind.JsonBigIntArray, [400n, 500n, 600n, 700n, 800n]],
            [RevealKind.JsonBigIntArray, [500n, 600n, 700n, 800n, 900n]],
            [RevealKind.JsonBigIntArray, [600n, 700n, 800n, 900n, 1000n]],
          ]),
          expected: [350n, 450n, 550n, 650n, 750n],
        },
      ];

      cases.forEach(({ inputs, expected }) => {
        test(`with ${inputs.length} reveals and 5 prices`, async () => {
          const oracleProgram = await file(WASM_PATH).arrayBuffer();

          const vmResult = await testOracleProgramTally(
            Buffer.from(oracleProgram),
            Buffer.from('tally-inputs'),
            inputs,
          );

          handleVmResult(vmResult, 0, expected);
        });
      });
    });

    describe('works with errored executions', () => {
      it('should ignore the errored execution', async () => {
        const oracleProgram = await file(WASM_PATH).arrayBuffer();

        const vmResult = await testOracleProgramTally(
          Buffer.from(oracleProgram),
          Buffer.from('tally-inputs'),
          createRevealArray([
            [RevealKind.JsonBigIntArray, [100n]],
            [RevealKind.Failed],
            [RevealKind.JsonBigIntArray, [200n]],
          ]),
        );

        handleVmResult(vmResult, 0, [150n]);
      });

      it('should ignore multiple errored executions', async () => {
        const oracleProgram = await file(WASM_PATH).arrayBuffer();

        const vmResult = await testOracleProgramTally(
          Buffer.from(oracleProgram),
          Buffer.from('tally-inputs'),
          createRevealArray([
            [RevealKind.JsonBigIntArray, [100n]],
            [RevealKind.Failed],
            [RevealKind.JsonBigIntArray, [200n]],
            [RevealKind.Failed],
            [RevealKind.JsonBigIntArray, [300n]],
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

        handleVmResult(vmResult, 1, [0n]);
      });
    });
  });
});
