// biome-ignore assist/source/organizeImports: biome is lying
import { expect } from 'bun:test';
import { AbiCoder as _AbiCoder } from 'ethers';
import type { HttpFetchResponseData, VmResult } from '@seda-protocol/vm';
import { TestDataProxy } from '@seda-protocol/dev-tools';

export const AbiCoder = _AbiCoder.defaultAbiCoder();

type RevealResult = {
  exitCode: number;
  gasUsed: number;
  inConsensus: boolean;
  result: Buffer;
};

function genericCreateSuccessfulReveal(result: Buffer): RevealResult {
  return {
    exitCode: 0,
    gasUsed: 0,
    inConsensus: true,
    result,
  };
}

function createSuccessfulJsonBigIntArrayReveal(values: bigint[]): RevealResult {
  const encoded = `[${values.map((v) => v.toString()).join(',')}]`;
  return genericCreateSuccessfulReveal(Buffer.from(encoded));
}

function createSuccessfulJsonBigIntReveal(value: bigint): RevealResult {
  const buf = Buffer.alloc(16);
  buf.writeBigUInt64LE(value & ((1n << 64n) - 1n), 0);
  buf.writeBigUInt64LE(value >> 64n, 8);
  const jsonBytes = Buffer.from(JSON.stringify(Array.from(buf)));
  return genericCreateSuccessfulReveal(jsonBytes);
}

function createSuccessfulBigIntReveal(value: bigint): RevealResult {
  const buf = Buffer.alloc(16);
  buf.writeBigUInt64LE(value & ((1n << 64n) - 1n), 0);
  buf.writeBigUInt64LE(value >> 64n, 8);
  return genericCreateSuccessfulReveal(buf);
}

function createSuccessfulBigIntArrayReveal(value: bigint[]): RevealResult {
  const buf = Buffer.alloc(16 * value.length);
  value.forEach((v, i) => {
    buf.writeBigUInt64LE(v & ((1n << 64n) - 1n), i * 16);
    buf.writeBigUInt64LE(v >> 64n, i * 16 + 8);
  });
  return genericCreateSuccessfulReveal(buf);
}

function createSuccessfulHttpFetchResponseReveal(data: HttpFetchResponseData): RevealResult {
  const jsonBytes = Buffer.from(JSON.stringify(data));
  return genericCreateSuccessfulReveal(jsonBytes);
}

function createFailedReveal(): RevealResult {
  return {
    exitCode: 1,
    gasUsed: 0,
    inConsensus: false,
    result: Buffer.from('Error while fetching symbol prices'),
  };
}

export enum RevealKind {
  JsonBigIntArray,
  JsonBigInt,
  BigInt,
  BigIntArray,
  Failed,
  HttpFetchResponse,
}

export type RevealInput =
  | [RevealKind.Failed]
  | [RevealKind.BigInt, bigint]
  | [RevealKind.BigIntArray, bigint[]]
  | [RevealKind.JsonBigInt, bigint]
  | [RevealKind.JsonBigIntArray, bigint[]]
  | [RevealKind.HttpFetchResponse, HttpFetchResponseData | unknown];

export function createRevealArray(values: RevealInput[]): RevealResult[] {
  return values.map(([kind, val]) => {
    switch (kind) {
      case RevealKind.Failed:
        return createFailedReveal();
      case RevealKind.BigInt:
        return createSuccessfulBigIntReveal(val as bigint);
      case RevealKind.BigIntArray:
        return createSuccessfulBigIntArrayReveal(val as bigint[]);
      case RevealKind.JsonBigInt:
        return createSuccessfulJsonBigIntReveal(val as bigint);
      case RevealKind.JsonBigIntArray:
        return createSuccessfulJsonBigIntArrayReveal(val as bigint[]);
      case RevealKind.HttpFetchResponse:
        return createSuccessfulHttpFetchResponseReveal(val as HttpFetchResponseData);
    }
  });
}

const data_proxy = new TestDataProxy();

export async function makeDataProxyResponse(
  url: string | URL,
  responseBody: unknown,
  method: string = 'GET',
  requestBody?: unknown,
): Promise<{
  dataProxyResponse: HttpFetchResponseData;
  mockedResponse: Response;
}> {
  if (typeof responseBody !== 'object' || responseBody === null) throw new Error('Invalid responseBody object');
  if (requestBody !== undefined && (typeof requestBody !== 'object' || requestBody === null))
    throw new Error('Invalid requestBody object');

  const urlStr = typeof url === 'string' ? url : url.href;
  const responseBodyBuffer = Buffer.from(JSON.stringify(responseBody));
  const requestBodyBuffer = requestBody ? Buffer.from(JSON.stringify(requestBody)) : undefined;
  const dataProxyResponse = await data_proxy.createResponse(urlStr, method, 200, responseBodyBuffer, requestBodyBuffer);
  const headersObj =
    dataProxyResponse.headers instanceof Headers
      ? Object.fromEntries(dataProxyResponse.headers.entries())
      : dataProxyResponse.headers;
  const res = new Response(Buffer.from(dataProxyResponse.bytes), {
    status: 200,
    headers: headersObj,
  });
  Object.defineProperty(res, 'url', { value: dataProxyResponse.url });
  Object.defineProperty(res, 'size', { value: dataProxyResponse.bytes.length });
  return {
    dataProxyResponse: { ...dataProxyResponse, headers: headersObj },
    mockedResponse: res,
  };
}

function genericHandleTallyVmResult<T>(vmResult: VmResult, exitCode: number, expected: T, codec?: string) {
  console.debug('Stdout:', vmResult.stdout);
  console.debug('Stderr:', vmResult.stderr);
  if (vmResult.exitCode !== 0) {
    console.error('Result:', Buffer.from(vmResult.result).toString('utf-8'));
  }
  expect(vmResult.exitCode).toBe(exitCode);

  // Decode the result using ethers' AbiCoder
  if (vmResult.exitCode === 0 && codec) {
    const [bnArray] = AbiCoder.decode([codec], vmResult.result) as unknown as [T];
    expect(bnArray).toEqual(expected);
  }
}

export function handleJsonBigIntExecutionVmResult(vmResult: VmResult, exitCode: number, expected: bigint) {
  genericHandleTallyVmResult(vmResult, exitCode, expected);
  if (vmResult.exitCode !== 0) return;

  // convert vmResult.result from bytes of json(serde_json::to_vec) to a buffer
  const jsonString = Buffer.from(vmResult.result).toString('utf-8');
  expect(jsonString).toBeDefined();
  expect(jsonString.length).toBeGreaterThan(0);
  const jsonArray = JSON.parse(jsonString);
  // convert Uint8Array of 16bytes(u128) to bigint from leBytes
  const buf = Buffer.from(jsonArray);
  expect(buf.length).toBe(16);
  const value = BigInt.asUintN(128, BigInt(buf.readBigUInt64LE(0)) + (BigInt(buf.readBigUInt64LE(8)) << 64n));
  expect(value).toBe(expected);
}

export function handleJsonArrayBigIntExecutionVmResult(vmResult: VmResult, exitCode: number, expected: bigint[]) {
  genericHandleTallyVmResult(vmResult, exitCode, expected);
  if (vmResult.exitCode !== 0) return;

  // convert vmResult.result from bytes of json(serde_json::to_vec) to a buffer
  const jsonString = Buffer.from(vmResult.result).toString('utf-8');
  expect(jsonString).toBeDefined();
  expect(jsonString.length).toBeGreaterThan(0);
  const jsonArray = JSON.parse(jsonString).map((v) => BigInt(v));
  expect(jsonArray).toEqual(expected);
}

export function handleBigIntExecutionVmResult(vmResult: VmResult, exitCode: number, expected: bigint) {
  genericHandleTallyVmResult(vmResult, exitCode, expected);
  if (vmResult.exitCode !== 0) return;

  // convert Uint8Array of 16bytes(u128) to bigint from leBytes
  const buf = Buffer.from(vmResult.result);
  expect(buf.length).toBe(16);
  const value = BigInt.asUintN(128, BigInt(buf.readBigUInt64LE(0)) + (BigInt(buf.readBigUInt64LE(8)) << 64n));
  expect(value).toBe(expected);
}

export function handleBigIntArrayExecutionVmResult(vmResult: VmResult, exitCode: number, expected: bigint[]) {
  genericHandleTallyVmResult(vmResult, exitCode, expected);
  if (vmResult.exitCode !== 0) return;

  // convert Uint8Array of n 16bytes(u128) to bigint[] from leBytes
  const buf = Buffer.from(vmResult.result);
  expect(buf.length % 16).toBe(0);
  const values = [];
  for (let i = 0; i < buf.length; i += 16) {
    const value = BigInt.asUintN(128, BigInt(buf.readBigUInt64LE(i)) + (BigInt(buf.readBigUInt64LE(i + 8)) << 64n));
    values.push(value);
  }
  expect(values).toEqual(expected);
}

export function handleHttpFetchResponseExecutionVmResult(
  vmResult: VmResult,
  exitCode: number,
  expected: unknown, // allow either bare or enveloped
  responseBody: unknown,
) {
  genericHandleTallyVmResult(vmResult, exitCode, expected);
  if (vmResult.exitCode !== 0) return;

  const parsed = JSON.parse(Buffer.from(vmResult.result).toString('utf-8'));
  expect(parsed).toEqual(expected); // compare whole shape (enveloped or not)
  const inner = parsed && typeof parsed === 'object' && 'response' in parsed ? parsed.response : parsed;
  const responseObject = JSON.parse(Buffer.from(inner.bytes).toString('utf-8'));
  expect(responseObject).toEqual(responseBody);
}

export function handleBigIntTallyVmResult(vmResult: VmResult, exitCode: number, expected: bigint) {
  genericHandleTallyVmResult(vmResult, exitCode, expected, 'uint256');
}

export function handleBigIntArrayTallyVmResult(vmResult: VmResult, exitCode: number, expected: bigint[]) {
  genericHandleTallyVmResult(vmResult, exitCode, expected, 'uint256[]');
}

export function handleJsonBigIntArrayExecutionVmResult(vmResult: VmResult, exitCode: number, expected: bigint[]) {
  genericHandleTallyVmResult(vmResult, exitCode, expected);
  if (vmResult.exitCode !== 0) return;

  // Parse JSON array of bigint strings
  const jsonString = Buffer.from(vmResult.result).toString('utf-8');
  expect(jsonString).toBeDefined();
  expect(jsonString.length).toBeGreaterThan(0);

  const jsonArray = JSON.parse(jsonString);
  expect(Array.isArray(jsonArray)).toBe(true);

  // Convert each string to bigint and compare
  const values = jsonArray.map((v: string) => BigInt(v));
  expect(values).toEqual(expected);
}
