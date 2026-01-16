# EVM Price Feed

Deployments:
- [Testnet](https://testnet.explorer.seda.xyz/oracle-programs/da91e2eb7906150993cddb911569ff1fb21f2783154435fad3bcc2bac990645b)

## Overview

This Oracle Program reads prices from on-chain VVS pools on Cronos (V2/V3) and returns a single price in a format compatible with EVM smart contracts. It supports one pair per request and calculates the median across oracle nodes.

You can test this Oracle Program on testnet with the following command:

```sh
cargo post-dr evm-price-feed WCRO-USDC -i da91e2eb7906150993cddb911569ff1fb21f2783154435fad3bcc2bac990645b
```

## Execution Phase

### Input Format

The execution phase expects a single pair string, either raw or JSON:

```
WCRO-USDC
{"pair":"WCRO-USDC"}
```

### Process

1. Validates the pair against a whitelist.
2. Reads reserves or slot0 from on-chain VVS pools via Cronos RPC.
3. Converts price to `u128` with 6 decimal precision.
4. Returns the price as little-endian bytes.

### Example

Input: `WCRO-USDC`
Output: `1000000` (price in 6 decimal precision)

## Tally Phase

### Input

No additional input is required for this Oracle Program as the Tally Phase only uses the reveals from the Execution Phase.

### Process

1. Collects all price reveals from oracle nodes.
1. Calculates the median price across reveals.
1. ABI-encodes the result as `int256[]` with a single element for EVM compatibility.
1. Posts the final result.

### Output Format

The result is ABI-encoded as `int256[]` containing a single median price.

### Example
If the median price was $1.00, the tally phase returns `[1000000]` ABI-encoded as `int256[]`.

## Supported Trading Pairs

Whitelisted pairs:
- WCRO-USDC
- VVS-WCRO
- WBTC-WCRO
- WCRO-ETH
- USDT-USDC
