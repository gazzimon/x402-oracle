import { loadConfig } from './config.js';
import { runPostBatches } from './postBatches.js';
import { runPostResults } from './postResults.js';

async function main() {
  const once = process.argv.includes('--once');
  const fromHeightRaw = getArg('--from-height');
  const fromHeight = fromHeightRaw ? BigInt(fromHeightRaw) : undefined;

  loadConfig();

  await runPostBatches({ once, fromHeight });
  await runPostResults({ once });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

function getArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}
