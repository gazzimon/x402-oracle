# Blocksize Volume Weighted Average Price

Deployments:
- [Testnet](https://testnet.explorer.seda.xyz/oracle-programs/5f4b8b833396c5aa2c705f2f67029f820cad81fe786b68f59aa43577a3323526)
- [Mainnet](https://explorer.seda.xyz/oracle-programs/727f1dd64209ceb66db3dd80ac5ac7cd7c767b13ecbdfab91c4a8bd30743bed7)


## Overview

The Execution Phase expects a price pair symbol, and optionally the field from the response to use. By default it will use all the fields from the API response.

You can test this Oracle Program on testnet with the following command:

```sh
cargo post-dr blocksize-vwap BTCUSD -i 5f4b8b833396c5aa2c705f2f67029f820cad81fe786b68f59aa43577a3323526 --gas-price 4000
```

## Execution Phase:

### Input Format

The Execution Phase expects a price pair symbol.

### Process

1. Validates the Data Request execution argument is not empty.
1. The inputs are validated.
1. Makes a HTTP call to the Blocksize Data Proxy.
1. Converts the decimal to a `u128` with 6 decimal precision.
2. Returns an array of bytes that is the fields in the specified order each in little endian format.

### Example


#### With No Fields Specified

Input: `BTCUSD`

Output: `[110772629556, 11160, 1236308948, 1757024761578]`


#### With a Field Specified

Input: `BTCUSD-price`

Output: `[110772629556]`

#### With a Fields Specified

Input: `BTCUSD-ts,price`

Output: `[1756147348689, 110772629556]`

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

This supports any price pair supported by the [Blocksize API](https://realtime.blocksize.dev/docs#/VWAP).

For quick reference, the JSON response is as follows:

```JSON
{
  "ticker": "BTCUSD",
  "price": 112269.91858575967,
  "size": 4.5646076099999995,
  "volume": 512468.12475063896,
  "ts": 1756147348689
}
```