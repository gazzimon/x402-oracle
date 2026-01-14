# VVS WCRO/USDC Oracle Program

This oracle program reads VVS pool reserves on Cronos EVM and returns the result as an EVM-compatible `uint256` with **8 decimals** (for example, `0.11234567` -> `11234567`).

## Overview

- Uses hardcoded VVS pool addresses
- Reads pool reserves (V2) or `slot0` (V3)
- Computes `quote / base` from on-chain state
- Outputs a single `uint256` (ABI-encoded) scaled to **8 decimals**

This matches the output expectations of the on-chain consumer used by the `single-price-feed-verification` example.

## Supported Pairs

The oracle supports the following pairs (input is case-insensitive):

- `WCRO-USDC`
- `VVS-WCRO`
- `WBTC-WCRO`
- `WCRO-ETH`
- `USDT-USDC`

## Execution Phase

- Calls Cronos JSON-RPC to read pool data
- Computes the price for the requested pair
- Returns the scaled price as bytes to the tally phase

## Tally Phase

- Parses the execution reveal as `u128`
- Computes the median if multiple reveals are present
- ABI-encodes the result as a single `uint256`

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

If no input is provided, the oracle defaults to `WCRO-USDC`.

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

- ABI-encoded `uint256`
- 8 decimal places

Example:

- Price: `0.10337707155555634033`
- Scaled: `10337707`
- ABI output: `uint256(10337707)`
