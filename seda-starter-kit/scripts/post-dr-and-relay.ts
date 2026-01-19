import { PostDataRequestInput, Signer, buildSigningConfig, postAndAwaitDataRequest } from '@seda-protocol/dev-tools';
import dotenv from 'dotenv';
import path from 'node:path';

async function main() {
  dotenv.config();
  if (!process.env.ORACLE_PROGRAM_ID) {
    throw new Error('Please set the ORACLE_PROGRAM_ID in your env file');
  }

  const signingConfig = buildSigningConfig({});
  const signer = await Signer.fromPartial(signingConfig);

  console.log('Posting and waiting for a result, this may take a little while..');

  const execInputs = process.env.EXEC_INPUTS ?? '';
  const execGasLimit = process.env.EXEC_GAS_LIMIT
    ? parseInt(process.env.EXEC_GAS_LIMIT, 10)
    : undefined;
  const tallyGasLimit = process.env.TALLY_GAS_LIMIT
    ? parseInt(process.env.TALLY_GAS_LIMIT, 10)
    : undefined;
  const dataRequestInput: PostDataRequestInput = {
    consensusOptions: {
      method: 'none'
    },
    execProgramId: process.env.ORACLE_PROGRAM_ID,
    execInputs: Buffer.from(execInputs),
    tallyInputs: Buffer.from([]),
    memo: Buffer.from(new Date().toISOString()),
    replicationFactor: 1,
    execGasLimit,
    tallyGasLimit
  };

  const timeoutSeconds = process.env.POST_DR_TIMEOUT_SECONDS
    ? parseInt(process.env.POST_DR_TIMEOUT_SECONDS, 10)
    : 180;
  const pollingIntervalSeconds = process.env.POST_DR_POLLING_INTERVAL_SECONDS
    ? parseInt(process.env.POST_DR_POLLING_INTERVAL_SECONDS, 10)
    : 10;
  const result = await postAndAwaitDataRequest(signer, dataRequestInput, {
    timeoutSeconds,
    pollingIntervalSeconds
  });
  const explorerLink = process.env.SEDA_EXPLORER_URL
    ? process.env.SEDA_EXPLORER_URL + `/data-requests/${result.drId}/${result.drBlockHeight}`
    : 'Configure env.SEDA_EXPLORER_URL to generate a link to your DR';

  console.table({
    ...result,
    blockTimestamp: result.blockTimestamp ? result.blockTimestamp.toISOString() : '',
    explorerLink
  });

  if (!result.drId) {
    throw new Error('Missing drId from SEDA response');
  }
  if (result.exitCode !== 0 || result.consensus !== true || !result.result) {
    throw new Error('SEDA response is not finalized (exitCode/consensus/result)');
  }

  const relayerDir = path.resolve(process.cwd(), 'relayer');
  console.log(`Relaying on demand for DR_ID ${result.drId}`);
  let pair = 'WCRO-USDC';
  try {
    const parsed = JSON.parse(execInputs) as { pair?: string };
    if (parsed.pair) {
      pair = parsed.pair;
    }
  } catch {
    // Use default pair if exec inputs are not JSON.
  }

  const drBlockHeight = result.drBlockHeight?.toString() ?? '';

  const proposeProc = Bun.spawn(
    [
      'bun',
      'run',
      'dev',
      '--',
      '--dr-id',
      result.drId,
      '--dr-block-height',
      drBlockHeight,
      '--dr-result',
      result.result,
      '--pair',
      pair,
      '--once',
      '--propose-only'
    ],
    {
      cwd: relayerDir,
      stdout: 'inherit',
      stderr: 'inherit'
    }
  );
  const proposeExitCode = await proposeProc.exited;
  if (proposeExitCode !== 0) {
    throw new Error(`Relayer propose failed with exit code ${proposeExitCode}`);
  }

  const finalizeDelaySeconds = process.env.RELAYER_FINALIZE_DELAY_SECONDS
    ? parseInt(process.env.RELAYER_FINALIZE_DELAY_SECONDS, 10)
    : 90;
  console.log(`Waiting ${finalizeDelaySeconds}s before finalize...`);
  await new Promise((resolve) => setTimeout(resolve, finalizeDelaySeconds * 1000));

  const finalizeProc = Bun.spawn(
    [
      'bun',
      'run',
      'dev',
      '--',
      '--dr-id',
      result.drId,
      '--dr-block-height',
      drBlockHeight,
      '--dr-result',
      result.result,
      '--pair',
      pair,
      '--once',
      '--finalize-only'
    ],
    {
      cwd: relayerDir,
      stdout: 'inherit',
      stderr: 'inherit'
    }
  );
  const finalizeExitCode = await finalizeProc.exited;
  if (finalizeExitCode !== 0) {
    throw new Error(`Relayer finalize failed with exit code ${finalizeExitCode}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
