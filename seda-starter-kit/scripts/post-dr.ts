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
            const values = decodeInt256Array(raw, 4);
            const scale = 1_000_000n;
            const fairPrice = formatScaled(values[0], scale);
            const confidence = formatScaled(values[1], scale);
            const maxSize = formatScaled(values[2], scale);
            const flags = values[3].toString();
            console.log(`fair_price (1e6): ${fairPrice}`);
            console.log(`confidence_score (1e6): ${confidence}`);
            console.log(`max_safe_execution_size (1e6): ${maxSize}`);
            console.log(`flags: ${flags}`);
        } catch (error) {
            console.warn('Could not decode result as int256[4]:', error);
        }
    }
}

main();

function decodeInt256Array(hex: string, expected: number): bigint[] {
    const cleaned = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (cleaned.length % 64 !== 0) {
        throw new Error(`Invalid ABI length: ${cleaned.length}`);
    }
    const chunks = cleaned.match(/.{1,64}/g) ?? [];
    if (chunks.length < 2) {
        throw new Error('Invalid ABI payload');
    }
    const offset = parseInt(chunks[0], 16) / 32;
    const length = parseInt(chunks[offset], 16);
    if (length !== expected) {
        throw new Error(`Expected ${expected} values, got ${length}`);
    }
    const values: bigint[] = [];
    for (let i = 0; i < length; i += 1) {
        const chunk = chunks[offset + 1 + i];
        values.push(decodeInt256(chunk));
    }
    return values;
}

function decodeInt256(chunk: string): bigint {
    const value = BigInt(`0x${chunk}`);
    const signBit = 1n << 255n;
    const max = 1n << 256n;
    return value & signBit ? value - max : value;
}

function formatScaled(value: bigint, scale: bigint): string {
    const negative = value < 0n;
    const abs = negative ? -value : value;
    const integer = abs / scale;
    const fraction = (abs % scale).toString().padStart(6, '0');
    return `${negative ? '-' : ''}${integer.toString()}.${fraction}`;
}
