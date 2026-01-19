# Batch Poster (Cronos Testnet)

Scaffolding service to post SEDA batches/results on-chain for the Cronos testnet deployment.
It **does not fake** batches, signatures, or proofs. You must wire official SEDA data sources.

## Setup

```bash
cd batch-poster
bun install
```

Create a `.env`:

```bash
CRONOS_RPC_URL=https://cronos-testnet-rpc-url
RELAYER_PRIVATE_KEY=0x...
PROVER_ADDRESS=0x101868e3aE4186336634573dbb8d261416C1B2fa
CORE_ADDRESS=0xBaB85A4ED8F27135883cd7ED90e93c040C14B16D

# Optional
SEDA_API_URL=https://<seda-endpoint>
POLL_INTERVAL_MS=15000
MAX_RETRIES=5
BACKOFF_BASE_MS=1000
STATE_PATH=./state.json
SANITY_CHECK=true
```

## Run

```bash
# batches only
bun run post:batches --once
bun run post:batches --from-height 1

# results only
bun run post:results --once

# both in one loop
bun run start --once
```

## TODOs (SEDA data sources)

Implement these in `batch-poster/src/sedaClient.ts` using official SEDA endpoints:

- `getLatestFinalizedBatchHeight()`
- `getBatch(height)` -> returns `SedaDataTypes.Batch`
- `getBatchSignatures(height)` -> `signatures[]` and `validatorProofs[]`
- `getResultInclusionProof(resultId, batchHeight)` -> `bytes32[]`
- `getFinalizedResults(fromBatchHeight)` -> results ready to post on-chain

Without these, the service will error out to avoid posting invalid data.
