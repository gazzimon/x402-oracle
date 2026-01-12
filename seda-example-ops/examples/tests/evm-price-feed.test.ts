// biome-ignore assist/source/organizeImports: biome is lying
import { file } from 'bun';
import { afterEach, describe, expect, it, mock } from 'bun:test';
import { testOracleProgramExecution, testOracleProgramTally } from '@seda-protocol/dev-tools';
import { match } from 'ts-pattern';
import {
  handleJsonBigIntArrayExecutionVmResult as handleExecutionVmResult,
  handleBigIntArrayTallyVmResult as handleTallyVmResult,
  createSuccessfulJsonBigIntArrayReveal as createSuccessfulReveal,
  createFailedReveal,
} from './utils.js';
import { ethers } from 'ethers';

const WASM_PATH = 'target/wasm32-wasip1/release/evm-price-feed.wasm';

const fetchMock = mock();

afterEach(() => {
  fetchMock.mockRestore();
});

describe('evm price feed', () => {
  describe('execution phase', () => {
    it('should return the correct price', async () => {
      fetchMock.mockImplementation((url) => {
        return match(url.host)
          .with('api.binance.com', () => {
            return new Response(JSON.stringify({ symbol: 'BTCUSDT', price: '117318.90000000' }));
          })
          .otherwise(() => {
            throw new Error(`Unexpected host: ${url.host}`);
          });
      });

      const oracleProgram = await file(WASM_PATH).arrayBuffer();
      const tickers = ['BTC-USDT'];
      const execInputsStr = ethers.AbiCoder.defaultAbiCoder().encode(['string[]'], [tickers]);
      // Remove '0x' prefix
      const execInputs = Buffer.from(execInputsStr.slice(2), 'hex');

      const vmResult = await testOracleProgramExecution(Buffer.from(oracleProgram), execInputs, fetchMock);
      handleExecutionVmResult(vmResult, 0, [117318900000n]);
    });

    it('should work with 2 prices', async () => {
      fetchMock.mockImplementation((url) => {
        return match(url.host)
          .with('api.binance.com', () => {
            // Check searchParams separately since it's a URLSearchParams object
            if (url.searchParams.get('symbol') === 'BTCUSDT') {
              return new Response(JSON.stringify({ symbol: 'BTCUSDT', price: '117318.90000000' }));
            }
            if (url.searchParams.get('symbol') === 'ETHUSDT') {
              return new Response(JSON.stringify({ symbol: 'ETHUSDT', price: '3844' }));
            }
            return new Response(JSON.stringify({ error: 'Missing symbol parameter' }), { status: 400 });
          })
          .otherwise(() => {
            throw new Error(`Unexpected host: ${url.host}`);
          });
      });

      const oracleProgram = await file(WASM_PATH).arrayBuffer();
      const tickers = ['BTC-USDT', 'ETH-USDT'];
      const execInputsStr = ethers.AbiCoder.defaultAbiCoder().encode(['string[]'], [tickers]);
      const execInputs = Buffer.from(execInputsStr.slice(2), 'hex');

      const vmResult = await testOracleProgramExecution(Buffer.from(oracleProgram), execInputs, fetchMock);
      handleExecutionVmResult(vmResult, 0, [117318900000n, 3844000000n]);
    });

    it('should not work if there are no prices', async () => {
      fetchMock.mockImplementation((url) => {
        return match(url.host)
          .with('api.binance.com', () => {
            return new Response(JSON.stringify({ error: 'No prices found' }));
          })
          .otherwise(() => {
            throw new Error(`Unexpected host: ${url.host}`);
          });
      });

      const oracleProgram = await file(WASM_PATH).arrayBuffer();
      const vmResult = await testOracleProgramExecution(Buffer.from(oracleProgram), Buffer.from('BTC-USD'), fetchMock);
      expect(vmResult.exitCode).toBe(1);
    });
  });

  describe('tally phase', () => {
    it('works with 1 price', async () => {
      const oracleProgram = await file(WASM_PATH).arrayBuffer();
      const vmResult = await testOracleProgramTally(Buffer.from(oracleProgram), Buffer.from('tally-inputs'), [
        createSuccessfulReveal([100n]),
      ]);
      handleTallyVmResult(vmResult, 0, [100n]);
    });

    it('works with 2 prices', async () => {
      const oracleProgram = await file(WASM_PATH).arrayBuffer();
      const vmResult = await testOracleProgramTally(Buffer.from(oracleProgram), Buffer.from('tally-inputs'), [
        createSuccessfulReveal([0n, 100n]),
        createSuccessfulReveal([0n, 200n]),
      ]);
      handleTallyVmResult(vmResult, 0, [0n, 150n]);
    });

    it('works with 5 prices', async () => {
      const oracleProgram = await file(WASM_PATH).arrayBuffer();
      const vmResult = await testOracleProgramTally(Buffer.from(oracleProgram), Buffer.from('tally-inputs'), [
        createSuccessfulReveal([100n, 0n, 0n, 0n, 0n]),
        createSuccessfulReveal([300n, 0n, 0n, 0n, 0n]),
        createSuccessfulReveal([200n, 0n, 0n, 0n, 0n]),
        createSuccessfulReveal([500n, 0n, 0n, 0n, 0n]),
        createSuccessfulReveal([400n, 0n, 0n, 0n, 0n]),
      ]);
      handleTallyVmResult(vmResult, 0, [300n, 0n, 0n, 0n, 0n]);
    });

    it('should ignore multiple errored executions', async () => {
      const oracleProgram = await file(WASM_PATH).arrayBuffer();

      const vmResult = await testOracleProgramTally(Buffer.from(oracleProgram), Buffer.from('tally-inputs'), [
        createSuccessfulReveal([100n]),
        createFailedReveal(),
        createSuccessfulReveal([200n]),
        createFailedReveal(),
        createSuccessfulReveal([300n]),
      ]);

      handleTallyVmResult(vmResult, 0, [200n]);
    });

    it('should error if all executions errored', async () => {
      const oracleProgram = await file(WASM_PATH).arrayBuffer();
      const vmResult = await testOracleProgramTally(Buffer.from(oracleProgram), Buffer.from('tally-inputs'), [
        createFailedReveal(),
        createFailedReveal(),
        createFailedReveal(),
      ]);

      handleTallyVmResult(vmResult, 1, [0n]);
    });
  });
});
