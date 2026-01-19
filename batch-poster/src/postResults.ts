import { loadConfig } from './config.js';
import { EvmClient } from './evmClient.js';
import { SedaClient } from './sedaClient.js';
import { loadState, saveState } from './state.js';

type RunOptions = {
  once: boolean;
};

export async function runPostResults(options: RunOptions) {
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
    const fromBatchHeight = state.lastResultBatchHeight
      ? BigInt(state.lastResultBatchHeight)
      : undefined;
    const finalized = await seda.getFinalizedResults(fromBatchHeight);
    if (finalized.length === 0) {
      console.log('No finalized results to post.');
      return;
    }

    for (const item of finalized) {
      if (state.postedResultIds[item.resultId]) {
        continue;
      }
      await withRetry(async () => {
        const proof =
          item.merkleProof.length > 0
            ? item.merkleProof
            : await seda.getResultInclusionProof(item.resultId, item.batchHeight);
        const tx = await evm.postResult(item.result, item.batchHeight, proof);
        console.log(`Posted result ${item.resultId} tx=${tx.hash}`);
        await tx.wait();
        state.postedResultIds[item.resultId] = true;
        if (item.batchHeight > BigInt(state.lastResultBatchHeight)) {
          state.lastResultBatchHeight = Number(item.batchHeight);
        }
        saveState(config.statePath, state);
      }, config);
      if (config.sanityCheck) {
        await evm.getResult(item.result.drId);
      }
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
  runPostResults({ once }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
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
