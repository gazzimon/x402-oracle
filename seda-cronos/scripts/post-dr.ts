// biome-ignore assist/source/organizeImports: biome complains about this no matter what
import {
  buildSigningConfig,
  postAndAwaitDataRequest,
  type PostDataRequestInput,
  Signer,
} from '@seda-protocol/dev-tools';
import { AbiCoder } from 'ethers';
import { Command } from 'commander';

function truncate(str: string, maxLen: number = 50): string {
  if (str.length <= maxLen) return str;
  const sliceLen = maxLen - 3;
  const head = Math.ceil(sliceLen / 2);
  const tail = Math.floor(sliceLen / 2);
  return `${str.slice(0, head)}...${str.slice(-tail)}`;
}

async function main() {
  const cli = new Command();

  cli
    .name('post-dr')
    .requiredOption('--oracle-program-id <id>', 'Oracle program ID')
    .option('--replication-factor <number>', 'Replication factor', '1')
    .option('--exec-inputs <inputs>', 'Execution inputs for the oracle program', [])
    .option('--tally-inputs <inputs>', 'Tally inputs for the oracle program', [])
    .option('--memo <memo>', 'Memo for the data request', new Date().toISOString())
    .option('--decode-abi <abi>', 'Decode the ABI of the oracle program')
    .option('--gas-price <price>', 'Gas price for the transaction')
    .option('--exec-gas-limit <limit>', 'Execution gas limit for the data request')
    .option('--tally-gas-limit <limit>', 'Tally gas limit for the data request')
    .option('--encode-exec-inputs <type>', 'ABI encode exec-inputs with the specified type (e.g., "string[]")')
    .parse(process.argv);

  const options = cli.opts();

  // Takes the mnemonic from the .env file (SEDA_MNEMONIC)
  const signingConfig = buildSigningConfig({
    mnemonic: process.env.SEDA_MNEMONIC,
  });
  const signer = await Signer.fromPartial(signingConfig);

  console.log('Posting and waiting for a result, this may take a little while..');

  // Handle ABI encoding of exec-inputs if specified
  let execInputs: Buffer;
  if (options.encodeExecInputs) {
    try {
      const coder = AbiCoder.defaultAbiCoder();
      // Parse the input as JSON if it looks like JSON, otherwise treat as string
      let parsedInput: any;
      try {
        parsedInput = JSON.parse(options.execInputs);
      } catch {
        // If not valid JSON, treat as a single string
        parsedInput = options.execInputs;
      }

      const encoded = coder.encode([options.encodeExecInputs], [parsedInput]);
      // Remove '0x' prefix and convert to Buffer
      execInputs = Buffer.from(encoded.slice(2), 'hex');
      console.log(`ABI encoded exec-inputs with type "${options.encodeExecInputs}": ${encoded}`);
    } catch (error) {
      console.error('Failed to ABI encode exec-inputs:', error);
      process.exit(1);
    }
  } else {
    // Backwards compatibility: treat as raw bytes
    execInputs = Buffer.from(options.execInputs);
  }

  const dataRequestInput: PostDataRequestInput = {
    consensusOptions: {
      method: 'none',
    },
    execProgramId: options.oracleProgramId,
    execInputs,
    tallyInputs: Buffer.from(options.tallyInputs),
    memo: Buffer.from(options.memo),
    replicationFactor: parseInt(options.replicationFactor, 10),
    gasPrice: options.gasPrice ? BigInt(options.gasPrice) : undefined,
    execGasLimit: options.execGasLimit ? parseInt(options.execGasLimit, 10) : undefined,
    tallyGasLimit: options.tallyGasLimit ? parseInt(options.tallyGasLimit, 10) : undefined,
  };

  const result = await postAndAwaitDataRequest(signer, dataRequestInput, {});
  const explorerLink = process.env.SEDA_EXPLORER_URL
    ? `${process.env.SEDA_EXPLORER_URL}/data-requests/${result.drId}/${result.drBlockHeight}`
    : 'Configure env.SEDA_EXPLORER_URL to generate a link to your DR';

  const printableResult = {
    ...result,
    blockTimestamp: result.blockTimestamp ? result.blockTimestamp.toISOString() : '',
    explorerLink,
  };
  const maxLength = result.drId.length;
  printableResult.result = truncate(result.result, maxLength);
  console.table(printableResult);

  if (options.decodeAbi) {
    if (result.exitCode !== 0) {
      console.error('Data request execution failed cannot decode ABI');
      return;
    }

    const data = result.result.trim().replace(/^0x/, '');
    const buf = Buffer.from(data, 'hex');

    const coder = AbiCoder.defaultAbiCoder();
    const [bnArray] = coder.decode([options.decodeAbi], buf) as unknown as [bigint[]];

    console.log('Decoded result:');
    console.table(bnArray);
  }
}

main();
