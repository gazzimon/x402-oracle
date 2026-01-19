import dotenv from 'dotenv';

dotenv.config();

type Config = {
  cronosRpcUrl: string;
  relayerPrivateKey: string;
  proverAddress: string;
  coreAddress: string;
  sedaApiUrl?: string;
  pollIntervalMs: number;
  maxRetries: number;
  backoffBaseMs: number;
  statePath: string;
  sanityCheck: boolean;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function loadConfig(): Config {
  return {
    cronosRpcUrl: requireEnv('CRONOS_RPC_URL'),
    relayerPrivateKey: requireEnv('RELAYER_PRIVATE_KEY'),
    proverAddress: requireEnv('PROVER_ADDRESS'),
    coreAddress: requireEnv('CORE_ADDRESS'),
    sedaApiUrl: process.env.SEDA_API_URL,
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? '15000', 10),
    maxRetries: parseInt(process.env.MAX_RETRIES ?? '5', 10),
    backoffBaseMs: parseInt(process.env.BACKOFF_BASE_MS ?? '1000', 10),
    statePath: process.env.STATE_PATH ?? './state.json',
    sanityCheck: process.env.SANITY_CHECK === 'true',
  };
}
