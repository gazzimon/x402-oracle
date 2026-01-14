# VVS WCRO/USDC Oracle Program

This oracle program fetches the WCRO/USDC price from VVS Finance and returns the result as an EVM-compatible `uint256` with **8 decimals** (for example, `0.11234567` -> `11234567`).

## Overview

- Calls Cronos EVM JSON-RPC against the VVS Factory
- Resolves the WCRO/USDC pair, fetches reserves, and computes USD per 1 WCRO
- Outputs a single `uint256` (ABI-encoded) scaled to **8 decimals**

This matches the output expectations of the on-chain consumer used by the `single-price-feed-verification` example.

## Execution Phase

- Calls Cronos JSON-RPC (`eth_call`) to resolve the pair and reserves
- Returns a compact payload (pair, token0, reserves) to the tally phase

## Tally Phase

- Parses the RPC payload
- Determines token order using `token0`
- Computes price from reserves and scales it to 8 decimals
- ABI-encodes the result as a single `uint256`

## Build (testnet)

```sh
cargo build --manifest-path oracle-program/Cargo.toml --target wasm32-wasip1 --release --no-default-features --features env-testnet
```

## RPC Configuration

By default the oracle uses a Cronos mainnet RPC URL embedded in the program. To override it, pass a custom RPC URL as the execution input when posting the data request (the starter kit `post-dr` script will read `CRONOS_RPC_URL` or `EXEC_INPUTS` from `.env`).

## Deploy and Post DR (testnet)

Latest testnet deployment:

- `oracleProgramId`: `0d59a8527cc89231d8e1b62f9b1640e1bb8094e921616e68d526d36509de5c4e`

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
ORACLE_PROGRAM_ID=0d59a8527cc89231d8e1b62f9b1640e1bb8094e921616e68d526d36509de5c4e
CRONOS_RPC_URL=https://mainnet-sticky.cronoslabs.com/v1/d3642384d334ff6ff1c4baebfdf3ef7d
```

## Output Format

- ABI-encoded `uint256`
- 8 decimal places

Example:

- Price: `0.10337707155555634033`
- Scaled: `10337707`
- ABI output: `uint256(10337707)`
