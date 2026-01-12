// biome-ignore assist/source/organizeImports: biome is lying
import { file } from 'bun';
import { afterEach, describe, it, mock } from 'bun:test';
import { testOracleProgramExecution, testOracleProgramTally } from '@seda-protocol/dev-tools';
import { match } from 'ts-pattern';
import {
  handleBigIntExecutionVmResult as handleExecutionVmResult,
  handleBigIntTallyVmResult as handleTallyVmResult,
  createRevealArray,
  RevealKind,
} from './utils.js';

const WASM_PATH = 'target/wasm32-wasip1/release/multi-price-feed.wasm';

const fetchMock = mock();

afterEach(() => {
  fetchMock.mockRestore();
});

describe('multi price feed', () => {
  describe('execution phase', () => {
    it('should return the correct price', async () => {
      fetchMock.mockImplementation((url) => {
        return match(url.host)
          .with('api.binance.com', () => {
            return new Response(JSON.stringify({ symbol: 'BTCUSDT', price: '117318.90000000' }));
          })
          .with('data.gateapi.io', () => {
            return new Response(JSON.stringify({ last: '2451.763000' }));
          })
          .with('api.kucoin.com', () => {
            return new Response(JSON.stringify({ data: { price: '2452.300000' } }));
          })
          .with('www.mexc.com', () => {
            return new Response(
              JSON.stringify({
                code: 200,
                data: [
                  {
                    symbol: 'BTC_USDT',
                    volume: '3332.47675483',
                    amount: '394182197.63',
                    high: '119272.73',
                    low: '117235.65',
                    bid: '117313.8',
                    ask: '117313.81',
                    open: '118185.71',
                    last: '117313.8',
                    time: 1753806782035,
                    change_rate: '-0.0073',
                  },
                ],
              }),
            );
          })
          .with('www.okx.com', () => {
            return new Response(
              JSON.stringify({
                code: '0',
                msg: '',
                data: [
                  {
                    instType: 'SPOT',
                    instId: 'BTC-USDT',
                    last: '117216.1',
                    lastSz: '0.00002474',
                    askPx: '117216.1',
                    askSz: '1.04574961',
                    bidPx: '117216',
                    bidSz: '0.72049894',
                    open24h: '118255.7',
                    high24h: '119300',
                    low24h: '117155',
                    volCcy24h: '463828560.42979406',
                    vol24h: '3924.03745314',
                    ts: '1753806883615',
                    sodUtc0: '118073.9',
                    sodUtc8: '117384.1',
                  },
                ],
              }),
            );
          })
          .otherwise(() => {
            throw new Error(`Unexpected host: ${url.host}`);
          });
      });

      const oracleProgram = await file(WASM_PATH).arrayBuffer();

      const vmResult = await testOracleProgramExecution(Buffer.from(oracleProgram), Buffer.from('BTC-USDT'), fetchMock);

      handleExecutionVmResult(vmResult, 0, 117313798144n);
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
      handleTallyVmResult(vmResult, 0, 100n);
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
      handleTallyVmResult(vmResult, 0, 150n);
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
      handleTallyVmResult(vmResult, 0, 300n);
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
      handleTallyVmResult(vmResult, 0, 550n);
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
      handleTallyVmResult(vmResult, 0, 250n);
    });

    describe('works with errored executions', () => {
      it('should ignore the errored execution', async () => {
        const oracleProgram = await file(WASM_PATH).arrayBuffer();

        const vmResult = await testOracleProgramTally(
          Buffer.from(oracleProgram),
          Buffer.from('tally-inputs'),
          createRevealArray([[RevealKind.BigInt, 100n], [RevealKind.Failed], [RevealKind.BigInt, 200n]]),
        );

        handleTallyVmResult(vmResult, 0, 150n);
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

        handleTallyVmResult(vmResult, 0, 200n);
      });

      it('should error if all executions errored', async () => {
        const oracleProgram = await file(WASM_PATH).arrayBuffer();
        const vmResult = await testOracleProgramTally(
          Buffer.from(oracleProgram),
          Buffer.from('tally-inputs'),
          createRevealArray([[RevealKind.Failed], [RevealKind.Failed], [RevealKind.Failed]]),
        );

        handleTallyVmResult(vmResult, 1, 0n);
      });
    });
  });
});
