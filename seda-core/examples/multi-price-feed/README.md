# Multi Price Feed

Deployments:
- [Testnet](https://testnet.explorer.seda.xyz/oracle-programs/e757d7b624d2bda11ab7f7916329c4a2762c11dc484d2eb861356e5fe5376924)
<!-- - [Mainnet]() -->

## Overview

This Oracle Program fetches the latest price pair data from several APIs (Binance, MEXC, OKX) and takes the median of them, posting the result in a format compatible with EVM smart contracts.

You can test this Oracle Program with the following command:

```sh
cargo post-dr multi-price-feed BTC-USD -i e757d7b624d2bda11ab7f7916329c4a2762c11dc484d2eb861356e5fe5376924 -r 3
```

## Execution Phase:

### Input Format

This oracle program takes in one argument for execution:
- A price pair hyphenated symbols i.e. `BTC-USD,ETH-USDT,etc...`

### Process

1. Validates the Data Request execution argument is in the format of `SymbolA-SymbolB`.
2. Makes HTTP calls to the three different APIs, converting their prices to `u128`s with 6 decimal precision.
3. Takes the median of those three prices.
4. Returns the `u128` in little endian format.

### Example

Input: `BTC-USD`
Output: `120334000128`

## Tally Phase

### Input

No additional input is required for this Oracle Program as the Tally Phase only uses the reveals from the Execution Phase.

### Process

1. Collects all price reveals from oracle nodes.
1. Calculates the median price from all the given prices.
1. ABI-encodes the result as a `uint256` for EVM compatibility.
1. Posts the final result.

### Output Format

The result is ABI-encoded as `uint256` where the final number is the median of all the collected price data.

### Example

If execution phase ran with a replication factor of 2 and the prices were:
- 100
- 200

The tally phase would return `150` ABI-encoded as a `uint256`.

## Supported Data

Supports any company available on the Binance, Mexc, and Okx APIs.
