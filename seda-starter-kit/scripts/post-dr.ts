import { PostDataRequestInput, Signer, buildSigningConfig, postAndAwaitDataRequest } from '@seda-protocol/dev-tools';
import dotenv from 'dotenv';

async function main() {
    dotenv.config();
    if (!process.env.ORACLE_PROGRAM_ID) {
        throw new Error('Please set the ORACLE_PROGRAM_ID in your env file');
    }

    // Takes the mnemonic from the .env file (SEDA_MNEMONIC and SEDA_RPC_ENDPOINT)
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
        tallyGasLimit,
    };

    const result = await postAndAwaitDataRequest(signer, dataRequestInput, {});
    const explorerLink = process.env.SEDA_EXPLORER_URL ? process.env.SEDA_EXPLORER_URL + `/data-requests/${result.drId}/${result.drBlockHeight}` : "Configure env.SEDA_EXPLORER_URL to generate a link to your DR";

    console.table({
        ...result,
        blockTimestamp: result.blockTimestamp ? result.blockTimestamp.toISOString() : '',
        explorerLink
    });

    if (result.exitCode === 0) {
        const raw = result.result?.startsWith('0x') ? result.result : `0x${result.result}`;
        try {
            const value = BigInt(raw);
            const scale = 100000000n;
            const integer = value / scale;
            const fraction = (value % scale).toString().padStart(8, '0');
            console.log(`Price (8 decimals): ${integer.toString()}.${fraction}`);
        } catch (error) {
            console.warn('Could not parse result as uint256:', error);
        }
    }
}

main();
