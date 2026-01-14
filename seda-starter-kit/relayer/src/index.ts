import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { ethers } from 'ethers';

type ExplorerRequest = {
  drId?: string;
  requestId?: string;
  execProgramId?: string;
  execInputs?: string;
  result?: { result?: string; exitCode?: number; consensus?: boolean } | string;
  exitCode?: number;
  consensus?: boolean;
};

const SEDA_API_URL = process.env.SEDA_API_URL ?? 'https://testnet.explorer.seda.xyz/data-requests';
const ORACLE_PROGRAM_ID = (process.env.ORACLE_PROGRAM_ID ?? '').toLowerCase();
const CRONOS_RPC_URL = process.env.CRONOS_RPC_URL ?? '';
const CONSUMER_ADDRESS = process.env.CONSUMER_ADDRESS ?? '';
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY ?? '';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? '15000', 10);
const DR_LIMIT = parseInt(process.env.DR_LIMIT ?? '50', 10);

const STATE_PATH = path.join(process.cwd(), '.relayer-state.json');

const consumerAbi = [
  'function submitResult(bytes32 requestId, bytes32 pair, uint256 value, bytes sedaProof)',
];

function loadState(): { processed: Record<string, boolean> } {
  if (!fs.existsSync(STATE_PATH)) {
    return { processed: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return { processed: {} };
  }
}

function saveState(state: { processed: Record<string, boolean> }) {
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

async function fetchRequests(): Promise<ExplorerRequest[]> {
  const url = new URL(SEDA_API_URL);
  if (!url.searchParams.has('limit')) {
    url.searchParams.set('limit', String(DR_LIMIT));
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Explorer fetch failed: ${response.status}`);
  }
  const payload = await response.json();
  return normalizeRequests(payload);
}

async function main() {
  if (!ORACLE_PROGRAM_ID || !CRONOS_RPC_URL || !CONSUMER_ADDRESS || !RELAYER_PRIVATE_KEY) {
    throw new Error('Missing required env vars. Check .env.example for required values.');
  }

  const provider = new ethers.JsonRpcProvider(CRONOS_RPC_URL);
  const wallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
  const consumer = new ethers.Contract(CONSUMER_ADDRESS, consumerAbi, wallet);
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const proof = coder.encode(['bytes32'], [ORACLE_PROGRAM_ID]);

  const state = loadState();

  const tick = async () => {
    const requests = await fetchRequests();
    for (const req of requests) {
      const requestId = req.drId ?? req.requestId;
      const execProgramId = (req.execProgramId ?? '').toLowerCase();
      if (!requestId || execProgramId !== ORACLE_PROGRAM_ID) continue;
      if (state.processed[requestId]) continue;

      const { result, exitCode, consensus } = extractResult(req);
      if (!result || exitCode !== 0 || consensus !== true) continue;

      const pair = decodeExecInputs(req.execInputs) ?? 'WCRO-USDC';
      const pairHash = ethers.keccak256(ethers.toUtf8Bytes(pair));

      const value = BigInt(result.startsWith('0x') ? result : `0x${result}`);
      console.log(`Relaying ${pair} (${requestId}) = ${value.toString()}`);

      const tx = await consumer.submitResult(requestId, pairHash, value, proof);
      await tx.wait();

      state.processed[requestId] = true;
      saveState(state);
    }
  };

  await tick();
  setInterval(() => tick().catch((err) => console.error(err)), POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
