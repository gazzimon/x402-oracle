# Simple Equity Price

Deployments:
- [Testnet](https://testnet.explorer.seda.xyz/oracle-programs/5e0153bfc2faf4a2f17b8efba694da57033d53035e0f9cc6e9c0c77d53767b4c)
<!-- - [Mainnet](https://explorer.seda.xyz/oracle-programs/) -->


## Overview

This Oracle Program gets the price of an equity in USD using the dxFeed API and returns the price in a format compatible with EVM smart contracts. The API is behind a Data Proxy.

You can test this Oracle Program on testnet with the following command:

```sh
cargo post-dr single-equity-price-verification TSLA -i 5e0153bfc2faf4a2f17b8efba694da57033d53035e0f9cc6e9c0c77d53767b4c --gas-price 4000
```

> ![NOTE] For this Oracle Program multiply `300000000000000` by your `replication-factor` to get your `exec-gas-limit`.

## Execution Phase:

### Input Format

The Execution Phase expects a commodity symbol, see [below](#supported-data) for allowed symbols.

### Process

1. Validates the Data Request execution argument is not empty.
1. Makes a HTTP call to the dxFeed Data Proxy.
1. Converts the decimal to a `u128` with 2 decimal precision.
1. Returns the `u128` in little endian format.

### Example

Input: `VAPE`

Output: `5500`


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

A Equity symbol from the approved list:
- SPY
- TSLA
- MSFT
- AAPL
- AMZN
- NVDA
- GOOG
- META
- UNH
- VAPE