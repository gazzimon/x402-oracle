# VVS WCRO/USDC Oracle Program

This oracle program fetches the WCRO/USDC price from VVS Finance and returns the result as an EVM-compatible `uint256` with **8 decimals** (for example, `0.11234567` -> `11234567`).

## Overview

- Fetches data from: `https://api.vvs.finance/info/api/pairs`
- Selects the WCRO/USDC pool with the **highest liquidity**
- Computes USD per 1 WCRO using the pool `price` field
- Outputs a single `uint256` (ABI-encoded) scaled to **8 decimals**

This matches the output expectations of the on-chain consumer used by the `single-price-feed-verification` example.

## Execution Phase

- Calls the VVS pairs API
- Returns the raw HTTP response bytes to the tally phase

## Tally Phase

- Parses the response JSON
- Filters pairs where:
  - `base_symbol == "WCRO"`
  - `quote_symbol == "USDC"`
- Picks the pool with the highest `liquidity`
- Parses `price` and scales it to 8 decimals
- ABI-encodes the result as a single `uint256`

## Build (testnet)

```sh
cargo build --manifest-path oracle-program/Cargo.toml --target wasm32-wasip1 --release --no-default-features --features env-testnet
```

## Output Format

- ABI-encoded `uint256`
- 8 decimal places

Example:

- Price: `0.10337707155555634033`
- Scaled: `10337707`
- ABI output: `uint256(10337707)`
