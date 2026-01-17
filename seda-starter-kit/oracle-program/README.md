# VVS WCRO/USDC Oracle Program

This oracle program reads VVS pool reserves on Cronos EVM and returns an **ABI-encoded `int256[]` (length 4)** with a single fixed-point scale of **1e6**.

## Overview

- Uses hardcoded VVS pool addresses
- Reads VVS pool reserves (V2)
- Uses on-chain 24h historical reserves to compute a simple 24h anchor price
- Outputs a canonical `int256[]` scaled to **1e6**

This matches the output expectations of the Cronos consumer used by x402 (single write, extensible array).

## Supported Pairs

The oracle supports only one pair for the demo (input is case-insensitive):

- `WCRO-USDC`

## Execution Phase

- Calls Cronos JSON-RPC to read pool data
- Computes spot price, 24h anchor price, and a simple TWAP proxy
- Returns the ABI-encoded `int256[]` to the tally phase

## Tally Phase

- Parses the execution reveal as `int256[]`
- Computes the median per field if multiple reveals are present
- ABI-encodes the result as `int256[]`

## Build (testnet)

```sh
cargo build --manifest-path oracle-program/Cargo.toml --target wasm32-wasip1 --release --no-default-features --features env-testnet
```

## Input Format

Execution input must be JSON:

```json
{
  "pair": "WCRO-USDC"
}
```

If input is missing or the pair is not whitelisted, execution fails.

## Deploy and Post DR (testnet)

Latest testnet deployment:

- `oracleProgramId`: update this after deploying your latest build

Example commands (from `seda-starter-kit/`):

```sh
./node_modules/.bin/seda-sdk oracle-program upload ./oracle-program/target/wasm32-wasip1/release-wasm/vvs-wcro-usdc-oracle.wasm
bun run post-dr
```

Minimal `.env` example:

```sh
SEDA_RPC_ENDPOINT=https://rpc.testnet.seda.xyz
SEDA_EXPLORER_URL=https://testnet.explorer.seda.xyz
SEDA_MNEMONIC="your mnemonic here"
ORACLE_PROGRAM_ID=your_oracle_program_id
EXEC_INPUTS={"pair":"WCRO-USDC"}
```

## Gas Notes

Switching from the large VVS pairs JSON payload to hardcoded pools + on-chain reads reduces execution gas materially. In our tests:

- Large JSON approach: ~`3.01e14` exec gas
- Hardcoded pools: ~`3.34e13` exec gas

## Output Format

All values are scaled by **1e6** and returned as `int256[]` in this fixed order:

```solidity
/// values[0] = fair_price (1e6)
/// values[1] = confidence_score (1e6)
/// values[2] = max_safe_execution_size (1e6)
/// values[3] = flags (bitmask: bit0 = volatility_alert)
```
