import { PostDataRequestInput, Signer, buildSigningConfig, postDataRequest } from '@seda-protocol/dev-tools';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
    dotenv.config();
    if (!process.env.ORACLE_PROGRAM_ID) {
        throw new Error('Please set the ORACLE_PROGRAM_ID in your env file');
    }

    // Takes the mnemonic from the .env file (SEDA_MNEMONIC and SEDA_RPC_ENDPOINT)
    const signingConfig = buildSigningConfig({});
    const signer = await Signer.fromPartial(signingConfig);

    console.log('Posting DR (no await).');

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

    const response = await postDataRequest(signer, dataRequestInput, {});
    const drId = response.dr?.id ?? '';
    const drBlockHeight = response.dr?.height ?? null;
    const drMetaPath = path.resolve(process.cwd(), '.last-dr.json');
    if (drId && drBlockHeight) {
        fs.writeFileSync(
            drMetaPath,
            JSON.stringify({ drId, drBlockHeight: drBlockHeight.toString() }, null, 2)
        );
    }
    const explorerLink = process.env.SEDA_EXPLORER_URL
        ? `${process.env.SEDA_EXPLORER_URL}/data-requests/${drId}/${drBlockHeight ?? ''}`
        : 'Configure env.SEDA_EXPLORER_URL to generate a link to your DR';

    console.table({
        drId,
        drBlockHeight: drBlockHeight?.toString?.() ?? drBlockHeight,
        explorerLink
    });

    console.log('DR posted. Use `bun run await-dr` to wait for the result.');
}

main();
