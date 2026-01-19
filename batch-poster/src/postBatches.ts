import { loadConfig } from './config.js';
import { EvmClient } from './evmClient.js';
import { SedaClient } from './sedaClient.js';
import { loadState, saveState } from './state.js';

type RunOptions = {
  once: boolean;
  fromHeight?: bigint;
};

export async function runPostBatches(options: RunOptions) {
  const config = loadConfig();
  const state = loadState(config.statePath);
  const seda = new SedaClient({ apiUrl: config.sedaApiUrl });
  const evm = new EvmClient({
    rpcUrl: config.cronosRpcUrl,
    privateKey: config.relayerPrivateKey,
    proverAddress: config.proverAddress,
    coreAddress: config.coreAddress,
  });

  const loop = async () => {
    const chainLast = await evm.getLastBatchHeight();
    const latest = await seda.getLatestFinalizedBatchHeight();
    const start = maxBigint(
      options.fromHeight ?? 1n,
      BigInt(state.lastPostedBatchHeight + 1),
      chainLast + 1n,
    );

    if (latest < start) {
      console.log(`No new batches (latest ${latest}, next ${start}).`);
      return;
    }

    for (let height = start; height <= latest; height += 1n) {
      await withRetry(async () => {
        const batch = await seda.getBatch(height);
        const { signatures, validatorProofs } = await seda.getBatchSignatures(height);
        const tx = await evm.postBatch(batch, signatures, validatorProofs);
        console.log(`Posted batch ${height} tx=${tx.hash}`);
        await tx.wait();
        state.lastPostedBatchHeight = Number(height);
        saveState(config.statePath, state);
      }, config);
    }
  };

  if (options.once) {
    await loop();
    return;
  }

  setInterval(() => {
    loop().catch((err) => console.error(err));
  }, config.pollIntervalMs);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const once = process.argv.includes('--once');
  const fromHeightRaw = getArg('--from-height');
  const fromHeight = fromHeightRaw ? BigInt(fromHeightRaw) : undefined;
  runPostBatches({ once, fromHeight }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

function getArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function maxBigint(...values: bigint[]): bigint {
  return values.reduce((max, value) => (value > max ? value : max), values[0]);
}

async function withRetry<T>(fn: () => Promise<T>, config: { maxRetries: number; backoffBaseMs: number }) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;
      if (attempt > config.maxRetries) {
        throw error;
      }
      const delay = config.backoffBaseMs * Math.pow(2, attempt - 1);
      console.warn(`Retrying in ${delay}ms (attempt ${attempt}/${config.maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
