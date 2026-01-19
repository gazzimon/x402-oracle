# Blocksize Bid Ask

Deployments:
- [Testnet](https://testnet.explorer.seda.xyz/oracle-programs/0befce19a31a9bb01ba0c3ed04d134498b0e55f356590103e8bd7f20a02ac582)
- [Mainnet](https://explorer.seda.xyz/oracle-programs/d5dff6a1ec7880fbf3267d8ffd5d787822d9f53e1e4989f3da88520bce43d370)


## Overview

This Oracle Program gets the price of a price pair using the Blocksize API and returns the price in a format compatible with EVM smart contracts. The API is behind a Data Proxy.

You can test this Oracle Program on testnet with the following command:

```sh
cargo post-dr blocksize-bidask ETHUSD -i 0befce19a31a9bb01ba0c3ed04d134498b0e55f356590103e8bd7f20a02ac582 --gas-price 4000
```

## Execution Phase:

### Input Format

The Execution Phase expects a price pair symbol, and optionally the field from the response to use. By default it will use all the fields from the API response.

### Process

1. Validates the Data Request execution argument is not empty.
1. The inputs are validated.
1. Makes a HTTP call to the Blocksize Data Proxy.
1. Converts the decimal to a `u128` with 6 decimal precision.
1. Returns an array of bytes that is the fields in the specified order each in little endian format.

### Examples

#### With No Fields Specified

Input: `ETHUSD`

Output: `[4326346792, 74548932, 4326410335, 127739791, 4326378563, 1757023918380518]`


#### With a Field Specified

Input: `ETHUSD-agg_bid_price`

Output: `[4362597230]`

#### With a Fields Specified

Input: `ETHUSD-ts,agg_bid_price`

Output: `[1757023918380518 4362597230]`

## Tally Phase

### Input

No additional input is required for this Oracle Program as the Tally Phase only uses the reveals from the Execution Phase.

### Process

1. Collects all price reveals from oracle nodes.
1. Calculates the median price from all the given prices.
1. ABI-encodes the result as a `uint256` for EVM compatibility.
1. Posts the final result preserving the order of the fields asked for.

### Output Format

The result is ABI-encoded as `uint256[]` where the final number is the median of all the collected price data.

### Example

If execution phase ran with a replication factor of 2 and the prices were:
- [100]
- [200]

The tally phase would return `[150]` ABI-encoded as a `uint256[]`.

## Supported Data

This supports any price pair supported by the [Blocksize API](https://realtime.blocksize.dev/docs#/Bid%20Ask).

For quick reference, the JSON response is as follows:

```JSON
{
  "ticker": "ETHUSD",
  "agg_bid_price": "4362.597230371793",
  "agg_bid_size": "98.42767488000001",
  "agg_ask_price": "4364.092969924804",
  "agg_ask_size": "125.29260208",
  "agg_mid_price": "4363.345100148298",
  "ts": 1756156227634385
}
```