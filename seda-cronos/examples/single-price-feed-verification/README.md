# Simple Price Feed Verification

Deployments:
- [Testnet](https://testnet.explorer.seda.xyz/oracle-programs/6bcdbb4cacf4a941888746c5122c30e84827d6f2f288dac63d8acd5f4b30a757)
<!-- - [Mainnet](https://explorer.seda.xyz/oracle-programs/) -->

## Overview

This Oracle Program gets the price of a single crypto asset in USD by leveraging the Coingecko API and returns the price in a format compatible with EVM smart contracts. The API is behind a Data Proxy.

You can test this Oracle Program on testnet with the following command:

```sh
cargo post-dr single-price-feed-verification BTC -i 6bcdbb4cacf4a941888746c5122c30e84827d6f2f288dac63d8acd5f4b30a757
```

## Execution Phase:

### Input format

The Execution Phase expects a single crypto symbol, either raw or JSON:
- `BTC`
- `{"pair":"BTC"}`

### Process

1. Validates the Data Request execution argument is not empty.
1. Makes a HTTP call to the dxFeed Data Proxy.
1. Converts the decimal to a `u128` with 6 decimal precision.
1. Returns the `u128` in little endian format.

### Example

Input: `"BTC"`

Output: `119792000000` (price in 6 decimal precision)

## Tally Phase

### Input

No additional input is required for this Oracle Program as the Tally Phase only uses the reveals from the Execution Phase.

### Process

1. Collects price reveals from oracle nodes.
1. Calculates the median price.
1. ABI-encodes the result as an `int256[]` with a single element for EVM compatibility.
1. Posts the final result.

### Output Format

The result is ABI-encoded as `int256[]` where the first element is the median of all the collected price data.

### Example

If execution phase ran with a replication factor of 2 and the prices were:
- 100
- 200

The tally phase would return `[150]` ABI-encoded as an `int256[]`.

## Supported Data

Whitelisted symbols:
- BTC
- ETH
- SOL
