# Simple Commodity Price

Deployments:
- [Testnet](https://testnet.explorer.seda.xyz/oracle-programs/1434bbb580db612a8de085e1c24d4db2984268ad9bd3c99352dc2b077f674cad)
- [Mainnet](https://explorer.seda.xyz/oracle-programs/9ebbd3ff5b31e6e1ae61c7dedb63f59e2f3f5ce2eb36ec45b84fa5a024c2081c)

## Overview

This Oracle Program gets the price of commodities in USD using the dxFeed API and returns the price in a format compatible with EVM smart contracts. The API is behind a Data Proxy.

You can test this Oracle Program on testnet with the following command:

```sh
cargo post-dr single-commodity-price BRN -i 1434bbb580db612a8de085e1c24d4db2984268ad9bd3c99352dc2b077f674cad --gas-price 4000 --exec-gas-limit 900000000000000 -r 3
```

> ![NOTE] For this Oracle Program multiply `300000000000000` by your `replication-factor` to get your `exec-gas-limit`.

## Execution Phase:

### Input Format

The Execution Phase expects a commodity symbol. Please see [below](#supported-data) for allowed symbols.

### Process

1. Validates the Data Request execution argument is not empty.
2. Makes an HTTP call to the dxFeed Data Proxy.
3. Converts the decimal to a `u128` with 2 decimal precision.
4. Returns the `u128` in little endian format.

### Example

Input: `BRN`

Output: `6717`


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

### Testnet

A Commodity symbol from the approved list:
- WTI
- BRN
- XAU

### Mainnet

A Commodity symbol from the approved list:
- DJI
- XPT
- WTI
- BRN
- SPX
- CAU
- XPD
- CUC
- NDX
- NGC
- XAG