# Deployments

This document records known deployments for this repo.

## Cronos Testnet (cronosTestnet, chainId 338)

**Status:** MVP/testnet bootstrap with batch 0 and zeroed roots.  
**Purpose:** Non-production anchoring for integration/testing.

### Parameters Used

- Prover params file: `config/initialBatch.testnet.json`
- Core params file: `config/core.testnet.json`

**Prover initial batch (testnet bootstrap):**

```
batchHeight: 0
blockHeight: 0
validatorsRoot: 0x0000000000000000000000000000000000000000000000000000000000000000
resultsRoot: 0x0000000000000000000000000000000000000000000000000000000000000000
provingMetadata: 0x0000000000000000000000000000000000000000000000000000000000000000
maxBatchAge: 100
feeManagerAddress: 0x1f50ddA97b3420861076e3B509107ff64694123c
```

### Deployed Addresses

- SedaFeeManager: `0x1f50ddA97b3420861076e3B509107ff64694123c`
- Secp256k1ProverV1 (Proxy): `0x101868e3aE4186336634573dbb8d261416C1B2fa`
- Secp256k1ProverV1 (Impl): `0x6Bf2BCc89681b74093c88fD482fF2f5e2B3cD6b3`
- SedaCoreV1 (Proxy): `0xBaB85A4ED8F27135883cd7ED90e93c040C14B16D`
- SedaCoreV1 (Impl): `0x4315179B09A30Cb60db8484fc273AEf8E4Ac34F4`

### Commands Used

```bash
bun run compile
bun run seda deploy:fee-manager --network cronosTestnet
bun run seda deploy:prover --params config/initialBatch.testnet.json --network cronosTestnet
bun run seda deploy:core --params config/core.testnet.json --network cronosTestnet
```

### Sanity Checks

```bash
bun run seda utils:query-prover --network cronosTestnet 0x101868e3aE4186336634573dbb8d261416C1B2fa
bun run seda utils:query-core --network cronosTestnet 0xBaB85A4ED8F27135883cd7ED90e93c040C14B16D
```
