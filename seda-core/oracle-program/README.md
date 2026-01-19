# VVS WCRO/USDC Oracle Program

This oracle program reads VVS pool reserves on Cronos EVM and returns an **ABI-encoded `int256[4]`** with a single fixed-point scale of **1e6**.

## Overview

- Uses hardcoded VVS pool addresses
- Reads VVS pool reserves (V2)
- Uses a ~24h historical anchor block for comparison
- Outputs a canonical `int256[4]` scaled to **1e6**

This matches the output expectations of the Cronos consumer used by x402 (single write, extensible array).

## Supported Pairs

The oracle supports only one pair for the demo (input is case-insensitive):

- `WCRO-USDC`

## Execution Phase

- Calls Cronos JSON-RPC to read pool data
- Computes spot price and ~24h anchor price
- Returns the ABI-encoded `int256[4]` to the tally phase

## Tally Phase

- Parses the execution reveal as `int256[4]`
- Computes the median per field if multiple reveals are present
- ABI-encodes the result as `int256[4]`

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

All values are scaled by **1e6** and returned as `int256[4]` in this fixed order:

```solidity
/// values[0] = fair_price (1e6)
/// values[1] = confidence_score (1e6)
/// values[2] = max_safe_execution_size (1e6)
/// values[3] = flags (bitmask: bit0 = volatility_alert)
```

## Validation Checklist (Testnet)

Use this section to validate the end-to-end pipeline for the jury.

- Oracle Program ID (SEDA): `0x61d26d8e7693b39a4296e1ecba45595bc7cdbbeecb1043c7034c8f99498f1504`
- DR ID (SEDA): `ba65b51684c798468ef9282cf245d96d45942beeec73a0b73c5c607ca768ed15`
- DR Explorer Link: `https://testnet.explorer.seda.xyz/data-requests/ba65b51684c798468ef9282cf245d96d45942beeec73a0b73c5c607ca768ed15/7299903`
- Cronos Consumer: `0xe0F946B25e4cce13FeF052cc76573fA8dF74D9D9`
- Relayer TX (Cronos testnet): `0x383aaf3d2ac7b36a4702fd62cd63db74405713fe9991a501b6b934c965748576`
- Cronos Explorer Link: `https://testnet.cronoscan.com/tx/0x383aaf3d2ac7b36a4702fd62cd63db74405713fe9991a501b6b934c965748576`

Observed values (1e6 scale):

- `values[0] = 102308` → `0.102308` (fair_price)
- `values[1] = 943288` → `0.943288` (confidence_score)
- `values[2] = 26581068577` → `26581.068577` (max_safe_execution_size)
- `values[3] = 0` (flags)

## Output Semantics (WCRO-USDC)

### Input (fixed)

Execution input must be JSON:

```json
{"pair":"WCRO-USDC"}
```

Any other input is rejected.

### On-chain data source

- Pool (VVS V2): `0xE61Db569E231B3f5530168Aa2C9D50246525b6d6`
- `token0()` selector: `0x0dfe1681`
- `getReserves()` selector: `0x0902f1ac`
- WCRO: `0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23` (18 decimals)
- USDC: `0xc21223249CA28397B4B6541dfFaEcC539BfF0c59` (6 decimals)

### Historical anchor block (~24h)

- Fetch latest block `B_now` via `eth_blockNumber`.
- Estimate `blocks_24h = 86400 / 5 = 17280`.
- Use `B_hist = B_now - blocks_24h` as the historical block tag.

### Spot and historical prices

Let `reserveUSDC` / `reserveWCRO` come from `getReserves()` after normalizing
by `token0()`:

```
spot_1e6 = (reserveUSDC_now * 1e18) / reserveWCRO_now
hist_1e6 = (reserveUSDC_hist * 1e18) / reserveWCRO_hist
```

### values[0] Fair Price

Weighted fair price (must include spot):

```
fair_price_1e6 = (2 * spot_1e6 + hist_1e6) / 3
```

### values[1] Confidence Score (1e6)

Two factors:

1) Liquidity factor (50/50 AMM proxy)

```
liquidity_usdc = reserveUSDC_now * 2
L = 500_000 * 1e6
liq_score_1e6 = min(1e6, (liquidity_usdc * 1e6) / L)
```

2) Temporal coherence factor (spot vs hist)

```
delta_1e6 = (abs(spot_1e6 - hist_1e6) * 1e6) / spot_1e6
time_score_1e6 = clamp(1e6 - (delta_1e6 * 1e6) / 50_000, 0, 1e6)
```

Weighted combine (60/40):

```
confidence_1e6 = (600_000 * liq_score_1e6 + 400_000 * time_score_1e6) / 1_000_000
```

### values[2] Max Safe Execution Size (1e6)

Max USDC input size such that price impact is <1% using AMM V2:

```
amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
effective_price_1e6 = (amountIn * 1e18) / amountOut
slippage_1e6 = (abs(effective_price_1e6 - spot_1e6) * 1e6) / spot_1e6
```

Find the maximum `amountIn` (USDC base units) with `slippage_1e6 < 10_000`
using bisection.

### values[3] Flags (bitmask)

```
bit0 (0x1): CRITICAL_DIVERGENCE if delta_1e6 > 50_000
bit1 (0x2): LOW_LIQUIDITY if liq_score_1e6 < 200_000
bit2 (0x4): UNSAFE_CONFIDENCE if confidence_1e6 < 200_000
```
