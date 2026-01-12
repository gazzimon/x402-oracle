# Simple Price Feed Verification

Deployments:
- [Testnet](https://testnet.explorer.seda.xyz/oracle-programs/6bcdbb4cacf4a941888746c5122c30e84827d6f2f288dac63d8acd5f4b30a757)
<!-- - [Mainnet](https://explorer.seda.xyz/oracle-programs/) -->

## Overview

This Oracle Program gets the price of specified crypto assets in USD by leveraging the Coingecko API and returns the price in a format compatible with EVM smart contracts. The API is behind a Data Proxy.

You can test this Oracle Program on testnet with the following command:

```sh
cargo post-dr single-price-feed-verification BTC,ETH -i 6bcdbb4cacf4a941888746c5122c30e84827d6f2f288dac63d8acd5f4b30a757
```

## Execution Phase:

### Input format

The Execution Phase expects a comma separated list of crypto symbols i.e. `BTC,ETH,etc...`

### Process

1. Ensures the Replication Factor is only 1.
1. Validates the Data Request execution argument is not empty.
1. Makes a HTTP call to the dxFeed Data Proxy.
1. Returns the bytes of the Http call.

### Example

Input: `"BTC,ETH"`

Output: `[119792000000, 4300910000]` (prices in 6 decimal precision)

## Tally Phase

### Input

No additional input is required for this Oracle Program as the Tally Phase only uses the reveals from the Execution Phase.

### Process

1. Ensures there was only a Replication Factor 1.
1. Gets the HttpFetch Data from the reveal.
1. Does the verification of the Proxy Response.
1. Converts the decimal to a `u128` with 6 decimal precision.
1. Returns the prices as a JSON array preserving the order the symbols were given in.
1. Calculates the median price from all the given prices for each crypto symbol individually.
1. ABI-encodes the result as a `uint256` for EVM compatibility.
1. Posts the final result returning the same order of symbols given in the Execution Phase.

### Output Format

The result is ABI-encoded as `uint256` where the final number is the median of all the collected price data.

### Example

If execution phase ran with a replication factor of 2 and the prices were:
- [100, 200]
- [200, 400]

The tally phase would return `[150, 300]` ABI-encoded as a `uint256[]`.

## Supported Data

Any crypto symbol supported by the CoinGecko API.