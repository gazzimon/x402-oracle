// biome-ignore assist/source/organizeImports: biome is lying
import { file } from 'bun';
import { afterEach, describe, it, mock } from 'bun:test';
import { testOracleProgramExecution, testOracleProgramTally } from '@seda-protocol/dev-tools';
import {
  handleBigIntTallyVmResult as handleVmResult,
  handleHttpFetchResponseExecutionVmResult as handleExecutionVmResult,
  createRevealArray,
  RevealKind,
  makeDataProxyResponse,
} from './utils.js';
import type { HttpFetchResponseData } from '@seda-protocol/vm';

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
      let expectedResponse: HttpFetchResponseData;
      fetchMock.mockImplementation(async (url) => {
        const response_info = await makeDataProxyResponse(url, responseBody);
        expectedResponse = response_info.dataProxyResponse;
        return response_info.mockedResponse;
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

      const verificationResponse = { response: expectedResponse, symbol: 'AAPL' };
      handleExecutionVmResult(vmResult, 0, verificationResponse, responseBody);
    });
  });

  describe('tally phase', () => {
    it('works', async () => {
      const requestBody = {
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
      const proxyResponse = await makeDataProxyResponse('http://test.dummy:5384/proxy/usd/AAPL', requestBody);

      const oracleProgram = await file(WASM_PATH).arrayBuffer();
      const vmResult = await testOracleProgramTally(
        Buffer.from(oracleProgram),
        Buffer.from('tally-inputs'),
        createRevealArray([
          [RevealKind.HttpFetchResponse, { response: proxyResponse.dataProxyResponse, symbol: 'AAPL' }],
        ]),
      );

      handleVmResult(vmResult, 0, 21444n);
    });

    describe('works with errored executions', () => {
      it('should error if all executions errored', async () => {
        const oracleProgram = await file(WASM_PATH).arrayBuffer();
        const vmResult = await testOracleProgramTally(
          Buffer.from(oracleProgram),
          Buffer.from('tally-inputs'),
          createRevealArray([[RevealKind.Failed]]),
        );

        handleVmResult(vmResult, 1, 0n);
      });
    });
  });
});
