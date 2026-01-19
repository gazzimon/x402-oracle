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
const SEDA_COSMWASM_REST_URL = process.env.SEDA_COSMWASM_REST_URL ?? '';
const SEDA_CORE_CONTRACT = process.env.SEDA_CORE_CONTRACT ?? '';
const SEDA_DR_STATUS = (process.env.SEDA_DR_STATUS ?? 'tallying')
  .split(',')
  .map((status) => status.trim().toLowerCase())
  .filter(Boolean);
const SEDA_ASSUME_CONSENSUS = process.env.SEDA_ASSUME_CONSENSUS === 'true';
const SEDA_ASSUME_EXIT_CODE_ZERO = process.env.SEDA_ASSUME_EXIT_CODE_ZERO === 'true';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? '15000', 10);
const DR_LIMIT = parseInt(process.env.DR_LIMIT ?? '50', 10);

const STATE_PATH = path.join(process.cwd(), '.relayer-state.json');

type RelayerState = {
  processed: Record<string, boolean>;
  proposed?: Record<string, boolean>;
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
const PROPOSE_ONLY = process.env.PROPOSE_ONLY === 'true' || hasArg('--propose-only');
const FINALIZE_ONLY = process.env.FINALIZE_ONLY === 'true' || hasArg('--finalize-only');
const ONESHOT =
  process.env.ONESHOT === 'true' || hasArg('--once') || Boolean(DR_ID) || Boolean(DR_RESULT);

const consumerAbi = [
  'function propose(bytes32 requestId, bytes32 pair, int256[4] value, bytes apiRef)',
  'function finalize(bytes32 requestId, int256[4] sedaValue, bytes sedaRef, bool consensus)',
];

function loadState(): RelayerState {
  if (!fs.existsSync(STATE_PATH)) {
    return { processed: {}, proposed: {} };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) as RelayerState;
    parsed.processed = parsed.processed ?? {};
    parsed.proposed = parsed.proposed ?? {};
    return parsed;
  } catch {
    return { processed: {}, proposed: {} };
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

function base64EncodeJson(value: unknown): string {
  const json = JSON.stringify(value);
  return Buffer.from(json, 'utf8').toString('base64');
}

function extractRevealResult(
  reveals: unknown,
): { result?: string; exitCode?: number; consensus?: boolean } {
  if (!reveals || typeof reveals !== 'object') return {};
  const entries = Object.values(reveals as Record<string, unknown>);
  if (entries.length === 0) return {};

  for (const entry of entries) {
    if (typeof entry === 'string') {
      return {
        result: entry,
        exitCode: SEDA_ASSUME_EXIT_CODE_ZERO ? 0 : undefined,
        consensus: SEDA_ASSUME_CONSENSUS ? true : undefined,
      };
    }

    if (Array.isArray(entry) && entry.length > 0 && entry.every((item) => Number.isInteger(item))) {
      const bytes = Uint8Array.from(entry as number[]);
      return {
        result: Buffer.from(bytes).toString('base64'),
        exitCode: SEDA_ASSUME_EXIT_CODE_ZERO ? 0 : undefined,
        consensus: SEDA_ASSUME_CONSENSUS ? true : undefined,
      };
    }

    if (entry && typeof entry === 'object') {
      const obj = entry as Record<string, unknown>;
      const resultValue =
        obj.result ??
        obj.result_bytes ??
        obj.reveal ??
        obj.value ??
        obj.data;
      const exitCodeValue = obj.exit_code ?? obj.exitCode;
      const consensusValue = obj.consensus;
      if (resultValue) {
        return {
          result: String(resultValue),
          exitCode: typeof exitCodeValue === 'number' ? exitCodeValue : SEDA_ASSUME_EXIT_CODE_ZERO ? 0 : undefined,
          consensus:
            typeof consensusValue === 'boolean' ? consensusValue : SEDA_ASSUME_CONSENSUS ? true : undefined,
        };
      }
    }
  }

  return {};
}

function normalizeCosmwasmRequests(payload: unknown): ExplorerRequest[] {
  if (!payload || typeof payload !== 'object') return [];
  const data = (payload as Record<string, unknown>).data as Record<string, unknown> | undefined;
  if (!data || typeof data !== 'object') return [];
  const requests = (data.data_requests as unknown[]) ?? [];
  if (!Array.isArray(requests)) return [];

  return requests.map((req) => {
    const item = req as Record<string, unknown>;
    const reveals = item.reveals;
    const extracted = extractRevealResult(reveals);
    return {
      drId: typeof item.id === 'string' ? item.id : undefined,
      execProgramId: typeof item.exec_program_id === 'string' ? item.exec_program_id : undefined,
      execInputs: typeof item.exec_inputs === 'string' ? item.exec_inputs : undefined,
      drBlockHeight: typeof item.height === 'number' ? item.height : undefined,
      result: extracted.result,
      exitCode: extracted.exitCode,
      consensus: extracted.consensus,
    } satisfies ExplorerRequest;
  });
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

function buildApiRef(requestId: string, pair: string, req: ExplorerRequest): Uint8Array {
  const ref = JSON.stringify({
    source: 'seda-explorer',
    requestId: stripHexPrefix(requestId),
    pair,
    execInputs: req.execInputs ?? null,
    drBlockHeight: req.drBlockHeight ?? req.blockHeight ?? null,
  });
  return ethers.toUtf8Bytes(ref);
}

function buildSedaRef(requestId: string, req: ExplorerRequest): Uint8Array {
  const ref = JSON.stringify({
    source: 'seda-explorer',
    requestId: stripHexPrefix(requestId),
    execProgramId: req.execProgramId ?? null,
    drBlockHeight: req.drBlockHeight ?? req.blockHeight ?? null,
  });
  return ethers.toUtf8Bytes(ref);
}

async function fetchRequests(): Promise<ExplorerRequest[]> {
  if (SEDA_COSMWASM_REST_URL && SEDA_CORE_CONTRACT) {
    return await fetchCosmwasmRequests();
  }

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

async function fetchCosmwasmRequests(): Promise<ExplorerRequest[]> {
  const base = SEDA_COSMWASM_REST_URL.replace(/\/+$/u, '');
  const results: ExplorerRequest[] = [];

  for (const status of SEDA_DR_STATUS) {
    let lastSeenIndex: string | null = null;
    let pageCount = 0;

    do {
      const query: Record<string, unknown> = {
        get_data_requests_by_status: {
          status,
          limit: DR_LIMIT,
          ...(lastSeenIndex ? { last_seen_index: lastSeenIndex } : {}),
        },
      };
      const encoded = base64EncodeJson(query);
      const url = new URL(
        `${base}/cosmwasm/wasm/v1/contract/${SEDA_CORE_CONTRACT}/smart/${encoded}`,
      );
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (x402-relayer)',
        },
      });
      if (!response.ok) {
        throw new Error(`CosmWasm fetch failed: ${response.status}`);
      }
      const payload = (await response.json()) as unknown;
      const normalized = normalizeCosmwasmRequests(payload);
      results.push(...normalized);

      const data = (payload as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
      lastSeenIndex = typeof data?.last_seen_index === 'string' ? data.last_seen_index : null;
      pageCount += 1;
      if (!normalized.length || !lastSeenIndex) break;
      if (pageCount > 10) break;
    } while (lastSeenIndex);
  }

  return results;
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
  if (PROPOSE_ONLY && FINALIZE_ONLY) {
    throw new Error('Use only one mode: --propose-only or --finalize-only.');
  }
  if (!ORACLE_PROGRAM_ID || !CRONOS_RPC_URL || !CONSUMER_ADDRESS || !RELAYER_PRIVATE_KEY) {
    throw new Error('Missing required env vars. Check .env.example for required values.');
  }

  const provider = new ethers.JsonRpcProvider(CRONOS_RPC_URL);
  const wallet = new ethers.Wallet(normalizeHex(RELAYER_PRIVATE_KEY), provider);
  const consumer = new ethers.Contract(CONSUMER_ADDRESS, consumerAbi, wallet);
  const coder = ethers.AbiCoder.defaultAbiCoder();

  const state = loadState();
  state.proposed = state.proposed ?? {};

  const relayRequest = async (req: ExplorerRequest) => {
    const requestId = req.drId ?? req.requestId;
    const execProgramId = (req.execProgramId ?? '').toLowerCase();
    if (!requestId || execProgramId !== ORACLE_PROGRAM_ID) return false;
    if (DR_ID && requestId !== DR_ID) return false;

    const { result, exitCode, consensus } = extractResult(req);
    if (!result || exitCode !== 0) return false;
    let finalizeTxHash: string | undefined;

    const pair = DR_PAIR || decodeExecInputs(req.execInputs) || 'WCRO-USDC';
    const pairHash = ethers.keccak256(ethers.toUtf8Bytes(pair));

    const resultHex = normalizeResult(result);
    const values = decodeResultArray(resultHex, coder);

    const requestIdHex = normalizeHex(requestId);
    let proposedSent = false;
    if (!state.proposed[requestId] && !state.processed[requestId] && !FINALIZE_ONLY) {
      console.log(`Proposing ${pair} (${requestId}) = [${values.join(', ')}]`);
      const apiRef = buildApiRef(requestId, pair, req);
      try {
        const tx = await consumer.propose(requestIdHex, pairHash, values, apiRef);
        console.log(`Proposed tx: ${tx.hash}`);
        await tx.wait();
        state.proposed[requestId] = true;
        saveState(state);
        proposedSent = true;
      } catch (err) {
        console.error(`Propose failed for ${requestId}:`, err);
      }
    }

    if (PROPOSE_ONLY) return proposedSent;
    if (state.processed[requestId]) return false;
    if (consensus !== true && consensus !== false) return false;

    console.log(`Finalizing ${pair} (${requestId}) = [${values.join(', ')}] (consensus: ${consensus})`);
    const sedaRef = buildSedaRef(requestId, req);
    try {
      const tx = await consumer.finalize(requestIdHex, values, sedaRef, consensus === true);
      console.log(`Finalized tx: ${tx.hash}`);
      await tx.wait();
      finalizeTxHash = tx.hash;
    } catch (err) {
      console.error(`Finalize failed for ${requestId}:`, err);
      return false;
    }

    state.processed[requestId] = true;
    if (consensus !== true) {
      state.proposed[requestId] = false;
      saveState(state);
      return false;
    }
    const drBlockHeight = req.drBlockHeight ?? req.blockHeight ?? DR_BLOCK_HEIGHT;
    const requestIdPlain = stripHexPrefix(requestId);
    state.lastByPair = state.lastByPair ?? {};
    state.lastByPair[pair] = {
      requestId: requestIdPlain,
      drBlockHeight,
      txHash: finalizeTxHash,
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
