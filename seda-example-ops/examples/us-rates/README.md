# Simple Price Feed

Deployments:
- [Testnet](https://testnet.explorer.seda.xyz/oracle-programs/50cff5a0423bdeffe509eccfc4cd2b61d926df5c64a7ef440561e35a131884ee)
- [Mainnet](https://mainnet.explorer.seda.xyz/oracle-programs/8eb8bb39a9d644bfde97cfb9b780c377c3f8c01fcc3298bc6f7921ffa51c5db2)

This Oracle Program gets the price of specified assets in by leveraging the Nobi API, and returns the price in a format compatible with EVM smart contracts. The API is behind a Data Proxy.

You can test this Oracle Program on testnet with the following command:

```sh
cargo post-dr us-rates Rates:US:US10Y,Crypto:ALL:BTC/USDT -i 50cff5a0423bdeffe509eccfc4cd2b61d926df5c64a7ef440561e35a131884ee
```

## Execution Phase:

### Input format

The Execution Phase expects a comma separated list of crypto symbols i.e. `Rates:US:US10Y,Crypto:ALL:BTC/USDT`

### Process

1. Validates the Data Request execution argument is not empty and a valid comma separated list.
2. Makes a HTTP call to the dxFeed Data Proxy for each asset.
3. Converts the decimals for each asset to a `u128` with 6 decimal precision.
4. Returns the prices as a JSON array preserving the order the symbols were given in.

### Example

Input: `"Rates:US:US10Y,Crypto:ALL:BTC/USDT"`

Output: `[4276774, 119149710596]` (prices in 6 decimal precision)

## Tally Phase

### Input

No additional input is required for this Oracle Program as the Tally Phase only uses the reveals from the Execution Phase.

### Process

1. Collects all price reveals from oracle nodes.
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

Any crypto symbol supported by the Nobi API.