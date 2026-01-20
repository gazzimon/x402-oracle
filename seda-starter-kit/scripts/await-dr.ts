import { Signer, awaitDataResult, buildSigningConfig } from '@seda-protocol/dev-tools';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

type DataRequestRef = {
    id: string;
    height: bigint;
};

function getArgValue(flag: string): string | null {
    const index = process.argv.indexOf(flag);
    if (index === -1) return null;
    return process.argv[index + 1] ?? null;
}

async function main() {
    dotenv.config();
    let drId = process.env.DR_ID ?? getArgValue('--dr-id') ?? '';
    let drBlockHeightRaw = process.env.DR_BLOCK_HEIGHT ?? getArgValue('--dr-block-height') ?? '';
    if (!drId || !drBlockHeightRaw) {
        const drMetaPath = path.resolve(process.cwd(), '.last-dr.json');
        if (fs.existsSync(drMetaPath)) {
            try {
                const meta = JSON.parse(fs.readFileSync(drMetaPath, 'utf8')) as {
                    drId?: string;
                    drBlockHeight?: string;
                };
                drId = drId || meta.drId || '';
                drBlockHeightRaw = drBlockHeightRaw || meta.drBlockHeight || '';
            } catch {
                // Ignore malformed cache file.
            }
        }
    }
    if (!drId || !drBlockHeightRaw) {
        throw new Error('Missing DR_ID or DR_BLOCK_HEIGHT. Pass --dr-id and --dr-block-height.');
    }

    const dr: DataRequestRef = {
        id: drId,
        height: BigInt(drBlockHeightRaw),
    };

    const timeoutSeconds = process.env.POST_DR_TIMEOUT_SECONDS
        ? parseInt(process.env.POST_DR_TIMEOUT_SECONDS, 10)
        : 300;
    const pollingIntervalSeconds = process.env.POST_DR_POLLING_INTERVAL_SECONDS
        ? parseInt(process.env.POST_DR_POLLING_INTERVAL_SECONDS, 10)
        : 10;

    const signingConfig = buildSigningConfig({});
    const signer = await Signer.fromPartial(signingConfig);

    console.log(`Waiting for DR ${drId} at height ${drBlockHeightRaw}...`);
    const result = await awaitDataResult({ rpc: signer.getEndpoint() }, dr, {
        timeoutSeconds,
        pollingIntervalSeconds,
    });

    const explorerLink = process.env.SEDA_EXPLORER_URL
        ? `${process.env.SEDA_EXPLORER_URL}/data-requests/${result.drId}/${result.drBlockHeight}`
        : 'Configure env.SEDA_EXPLORER_URL to generate a link to your DR';

    console.table({
        ...result,
        blockTimestamp: result.blockTimestamp ? result.blockTimestamp.toISOString() : '',
        explorerLink,
    });
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
