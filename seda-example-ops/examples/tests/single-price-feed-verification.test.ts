// biome-ignore assist/source/organizeImports: biome is lying
import { file } from 'bun';
import { afterEach, describe, it, mock } from 'bun:test';
import { testOracleProgramExecution, testOracleProgramTally } from '@seda-protocol/dev-tools';
import {
  handleBigIntArrayTallyVmResult as handleVmResult,
  handleHttpFetchResponseExecutionVmResult as handleExecutionVmResult,
  createRevealArray,
  RevealKind,
  makeDataProxyResponse,
} from './utils.js';
import type { HttpFetchResponseData } from '@seda-protocol/vm';

const WASM_PATH = 'target/wasm32-wasip1/release/single-price-feed-verification.wasm';

const fetchMock = mock();

afterEach(() => {
  fetchMock.mockRestore();
});

describe('single price feed verification', () => {
  describe('execution phase', () => {
    it('works', async () => {
      const responseBody = {
        bitcoin: { usd: 121239 },
        ethereum: { usd: 4658.03 },
      };
      let expectedResponse: HttpFetchResponseData;
      fetchMock.mockImplementation(async (url) => {
        const response_info = await makeDataProxyResponse(url, responseBody);
        expectedResponse = response_info.dataProxyResponse;
        return response_info.mockedResponse;
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

      handleExecutionVmResult(vmResult, 0, expectedResponse, responseBody);
    });
  });

  describe('tally phase', () => {
    it('works', async () => {
      const requestBody = {
        btc: { usd: 113301 },
        eth: { usd: 4151.3 },
      };
      const proxyResponse = await makeDataProxyResponse('http://test.dummy:5384/proxy/usd/BTC,ETH', requestBody);

      const oracleProgram = await file(WASM_PATH).arrayBuffer();
      const vmResult = await testOracleProgramTally(
        Buffer.from(oracleProgram),
        Buffer.from('tally-inputs'),
        createRevealArray([[RevealKind.HttpFetchResponse, proxyResponse.dataProxyResponse]]),
      );

      handleVmResult(vmResult, 0, [113301000000n, 4151300000n]);
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
