# Caplight End of Day Market Price

Deployments:
- [Testnet](https://testnet.explorer.seda.xyz/oracle-programs/93e349bc67017b4c62696d5e96ec7e7dce6e3ef679b930b0a219a08fee8f86fb): Non String Result
- [Testnet](https://testnet.explorer.seda.xyz/oracle-programs/5e42846397786ccb3fdbce7d5b786585b635703ae240cc45eeeaa16a2d7a45b7): String Result
- [Mainnet](https://explorer.seda.xyz/oracle-programs/bb688e6c356014cda17d55662d614149050630bd30507f29045868358a38aa8b): String Result

## Overview

This Oracle Program fetches the latest market data returned from the [Caplight API](https://platform.caplight.com/api/documentation.html#tag/MarketPrice/paths/~1market-price-history/get) and returns a single price in a format compatible with EVM smart contracts. It takes a single pitchbook ID and calculates the median across reveals. The API is behind a Data Proxy.

You can test this Oracle Program on testnet with the following command:

```sh
cargo post-dr caplight-eod-market-price 54782-29 -i 93e349bc67017b4c62696d5e96ec7e7dce6e3ef679b930b0a219a08fee8f86fb -r 3
```

## Execution Phase:

### Input Format

The Execution Phase expects a single `pitchbookId` (whitelisted).

### Process

1. Validates the Data Request execution argument is not empty.
2. Makes an HTTP call to the Caplight Data Proxy.
3. Converts the decimal to a `u128` with 6 decimal precision.
4. Returns the `u128` in little endian format.

### Example

Input: `54782-29`

Output: `4221000`

## Tally Phase

### Input

No additional input is required for this Oracle Program as the Tally Phase only uses the reveals from the Execution Phase.

### Process

1. Collects all price reveals from oracle nodes.
1. Calculates the median price from all the given prices.
1. ABI-encodes the result as an `int256[]` with a single element for EVM compatibility.
1. Posts the final result.

### Output Format

The result is ABI-encoded as `int256[]` where the first element is the median of all the collected price data.

### Example

If execution phase ran with a replication factor of 2 and the prices were:
- 100
- 200

The tally phase would return `150` ABI-encoded as a `uint256`.

## Supported Data

Whitelisted pitchbook IDs:
- 54782-29
