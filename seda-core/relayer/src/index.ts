import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { ethers } from 'ethers';

type ExplorerRequest = {
  drId?: string;
  requestId?: string;
  execProgramId?: string;
  execInputs?: string;
  drBlockHeight?: number;
  blockHeight?: number;
  result?: { result?: string; exitCode?: number; consensus?: boolean } | string;
  exitCode?: number;
  consensus?: boolean;
};

const SEDA_API_URL = process.env.SEDA_API_URL ?? 'https://testnet.explorer.seda.xyz/api/data-requests';
const ORACLE_PROGRAM_ID = (process.env.ORACLE_PROGRAM_ID ?? '').toLowerCase();
const CRONOS_RPC_URL = process.env.CRONOS_RPC_URL ?? '';
const CONSUMER_ADDRESS = process.env.CONSUMER_ADDRESS ?? '';
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY ?? '';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? '15000', 10);
const DR_LIMIT = parseInt(process.env.DR_LIMIT ?? '50', 10);

const STATE_PATH = path.join(process.cwd(), '.relayer-state.json');

type RelayerState = {
  processed: Record<string, boolean>;
  lastByPair?: Record<
    string,
    {
      requestId: string;
      drBlockHeight?: number;
      txHash?: string;
      updatedAt?: string;
    }
  >;
};

function getArgValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function hasArg(flag: string): boolean {
  return process.argv.includes(flag);
}

const DR_ID = process.env.DR_ID ?? getArgValue('--dr-id') ?? '';
const DR_RESULT = process.env.DR_RESULT ?? getArgValue('--dr-result') ?? '';
const DR_PAIR = process.env.DR_PAIR ?? getArgValue('--pair') ?? '';
const DR_EXEC_INPUTS = process.env.DR_EXEC_INPUTS ?? getArgValue('--exec-inputs') ?? '';
const DR_BLOCK_HEIGHT_RAW = process.env.DR_BLOCK_HEIGHT ?? getArgValue('--dr-block-height') ?? '';
const DR_BLOCK_HEIGHT = DR_BLOCK_HEIGHT_RAW ? parseInt(DR_BLOCK_HEIGHT_RAW, 10) : undefined;
const ONESHOT =
  process.env.ONESHOT === 'true' || hasArg('--once') || Boolean(DR_ID) || Boolean(DR_RESULT);

const consumerAbi = [
  'function submitResult(bytes32 requestId, bytes32 pair, int256[4] values, bytes sedaProof)',
];

function loadState(): RelayerState {
  if (!fs.existsSync(STATE_PATH)) {
    return { processed: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return { processed: {} };
  }
}

function saveState(state: RelayerState) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function normalizeRequests(payload: unknown): ExplorerRequest[] {
  if (Array.isArray(payload)) return payload as ExplorerRequest[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as ExplorerRequest[];
    if (Array.isArray(obj.results)) return obj.results as ExplorerRequest[];
  }
  return [];
}

function decodeExecInputs(execInputs?: string): string | null {
  if (!execInputs) return null;
  try {
    const decoded = Buffer.from(execInputs, 'base64').toString('utf8').trim();
    if (!decoded) return null;
    const parsed = JSON.parse(decoded) as { pair?: string };
    return parsed.pair ?? null;
  } catch {
    return null;
  }
}

function extractResult(req: ExplorerRequest): { result?: string; exitCode?: number; consensus?: boolean } {
  if (typeof req.result === 'string') {
    return { result: req.result, exitCode: req.exitCode, consensus: req.consensus };
  }
  if (req.result && typeof req.result === 'object') {
    const resultObj = req.result as { result?: string; exitCode?: number; consensus?: boolean };
    return resultObj;
  }
  return {};
}

function normalizeHex(value: string): string {
  if (!value) return value;
  return value.startsWith('0x') ? value : `0x${value}`;
}

function stripHexPrefix(value: string): string {
  return value.startsWith('0x') ? value.slice(2) : value;
}

function decodeResultArray(resultHex: string, coder: ethers.AbiCoder): bigint[] {
  const decoded = coder.decode(['int256[]'], resultHex);
  const rawValues = decoded[0] as readonly bigint[];
  const values = Array.from(rawValues);
  if (values.length !== 4) {
    throw new Error(`Expected 4 values, got ${values.length}`);
  }
  return values;
}

function normalizeResult(result: string): string {
  const trimmed = result.trim();
  if (trimmed.startsWith('0x')) {
    return trimmed;
  }
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    return `0x${trimmed}`;
  }
  const bytes = Buffer.from(trimmed, 'base64');
  return `0x${bytes.toString('hex')}`;
}

async function fetchRequests(): Promise<ExplorerRequest[]> {
  const baseUrl = new URL(SEDA_API_URL);
  if (!baseUrl.searchParams.has('limit')) {
    baseUrl.searchParams.set('limit', String(DR_LIMIT));
  }

  const attempts: URL[] = [new URL(baseUrl.toString())];
  if (!baseUrl.searchParams.has('format')) {
    const withFormat = new URL(baseUrl.toString());
    withFormat.searchParams.set('format', 'json');
    attempts.push(withFormat);
  }
  if (!baseUrl.searchParams.has('json')) {
    const withJson = new URL(baseUrl.toString());
    withJson.searchParams.set('json', '1');
    attempts.push(withJson);
  }

  let lastError: Error | null = null;
  for (const url of attempts) {
    try {
      return await fetchJson(url);
    } catch (err) {
      lastError = err as Error;
    }
  }

  throw lastError ?? new Error('Explorer fetch failed');
}

async function fetchJson(url: URL): Promise<ExplorerRequest[]> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (x402-relayer)',
      Referer: 'https://testnet.explorer.seda.xyz/',
      Origin: 'https://testnet.explorer.seda.xyz',
      'Cache-Control': 'no-cache'
    }
  });
  if (!response.ok) {
    throw new Error(`Explorer fetch failed: ${response.status}`);
  }
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  if (!contentType.includes('application/json')) {
    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return normalizeRequests(JSON.parse(trimmed));
    }
    const snippet = text.slice(0, 120).replace(/\s+/g, ' ');
    throw new Error(
      `Explorer returned non-JSON response (url: ${response.url}). Check SEDA_API_URL. Body: ${snippet}`,
    );
  }
  const payload = JSON.parse(text);
  return normalizeRequests(payload);
}

async function main() {
  if (!ORACLE_PROGRAM_ID || !CRONOS_RPC_URL || !CONSUMER_ADDRESS || !RELAYER_PRIVATE_KEY) {
    throw new Error('Missing required env vars. Check .env.example for required values.');
  }

  const provider = new ethers.JsonRpcProvider(CRONOS_RPC_URL);
  const wallet = new ethers.Wallet(normalizeHex(RELAYER_PRIVATE_KEY), provider);
  const consumer = new ethers.Contract(CONSUMER_ADDRESS, consumerAbi, wallet);
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const proof = coder.encode(['bytes32'], [normalizeHex(ORACLE_PROGRAM_ID)]);

  const state = loadState();

  const relayRequest = async (req: ExplorerRequest) => {
    const requestId = req.drId ?? req.requestId;
    const execProgramId = (req.execProgramId ?? '').toLowerCase();
    if (!requestId || execProgramId !== ORACLE_PROGRAM_ID) return false;
    if (DR_ID && requestId !== DR_ID) return false;
    if (state.processed[requestId]) return false;

    const { result, exitCode, consensus } = extractResult(req);
    if (!result || exitCode !== 0 || consensus !== true) return false;

    const pair = DR_PAIR || decodeExecInputs(req.execInputs) || 'WCRO-USDC';
    const pairHash = ethers.keccak256(ethers.toUtf8Bytes(pair));

    const resultHex = normalizeResult(result);
    const values = decodeResultArray(resultHex, coder);
    console.log(`Relaying ${pair} (${requestId}) = [${values.join(', ')}]`);

    const requestIdHex = normalizeHex(requestId);
    const tx = await consumer.submitResult(requestIdHex, pairHash, values, proof);
    console.log(`Submitted tx: ${tx.hash}`);
    await tx.wait();

    state.processed[requestId] = true;
    const drBlockHeight = req.drBlockHeight ?? req.blockHeight ?? DR_BLOCK_HEIGHT;
    const requestIdPlain = stripHexPrefix(requestId);
    state.lastByPair = state.lastByPair ?? {};
    state.lastByPair[pair] = {
      requestId: requestIdPlain,
      drBlockHeight,
      txHash: tx.hash,
      updatedAt: new Date().toISOString(),
    };
    saveState(state);
    return true;
  };

  const tick = async () => {
    const requests = await fetchRequests();
    let matched = false;
    let relayed = 0;
    for (const req of requests) {
      const requestId = req.drId ?? req.requestId;
      const execProgramId = (req.execProgramId ?? '').toLowerCase();
      if (!requestId || execProgramId !== ORACLE_PROGRAM_ID) continue;
      if (DR_ID && requestId !== DR_ID) continue;
      matched = true;
      const didRelay = await relayRequest(req);
      if (didRelay) relayed += 1;
    }
    return { matched, relayed };
  };

  if (DR_ID && DR_RESULT) {
    const request: ExplorerRequest = {
      drId: DR_ID,
      execProgramId: ORACLE_PROGRAM_ID,
      execInputs: DR_EXEC_INPUTS || undefined,
      drBlockHeight: DR_BLOCK_HEIGHT,
      result: DR_RESULT,
      exitCode: 0,
      consensus: true
    };
    const didRelay = await relayRequest(request);
    if (!didRelay) {
      throw new Error(`DR_ID provided but not relayed: ${DR_ID}`);
    }
    return;
  }

  const { matched, relayed } = await tick();
  if (ONESHOT) {
    if (!matched) {
      throw new Error(`DR_ID not found in explorer response: ${DR_ID}`);
    }
    if (relayed === 0) {
      throw new Error(`DR_ID found but not relayed yet: ${DR_ID}`);
    }
    return;
  }
  setInterval(() => tick().catch((err) => console.error(err)), POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
