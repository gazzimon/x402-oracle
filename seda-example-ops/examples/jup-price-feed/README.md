# Jupiter Price Feed

Deployments:
- [Testnet](https://testnet.explorer.seda.xyz/oracle-programs/6115dbd31500fda073eaf1f8d3a7abff5f2e1e9f434982e7a466e7789dfd3406)
- [Mainnet](https://explorer.seda.xyz/oracle-programs/f7076891e558ff8fc14bfaf4de16f015fd780d279bf2ed2e0f4e915c169c6850)

## Overview

This Oracle Program gets the price of a specified Solana token in USD by leveraging the Jupiter Lite API and returns the raw price as a string. This program handles one token at a time.

You can test this Oracle Program on testnet with the following command:

```sh
cargo post-dr jup-price-feed -n seda So11111111111111111111111111111111111111112 -i f7076891e558ff8fc14bfaf4de16f015fd780d279bf2ed2e0f4e915c169c6850
```

## Execution Phase:

### Input format

The Execution Phase expects a single Solana token contract address i.e. `So11111111111111111111111111111111111111112` (SOL).

### Process

1. Validates the Data Request execution argument is not empty.
1. Makes a HTTP call to the Jupiter Lite API.
1. Extracts the `usdPrice` field from the response for the specified token.
1. Returns the raw price as a string.

### Example

Input: `"So11111111111111111111111111111111111111112"`

Output: `"245.67"` (raw USD price as string)

## Tally Phase

### Input

No additional input is required for this Oracle Program as the Tally Phase only uses the reveals from the Execution Phase.

### Process

1. Collects all price reveals from oracle nodes.
1. Parses each reveal as a raw f64 price value.
1. Calculates the median price from all the collected prices.
1. Returns the final median price as a string.

### Output Format

The result is returned as a string representation of the median price.

### Example

If execution phase ran with a replication factor of 3 and the prices were:
- 245.50
- 245.67  
- 245.80

The tally phase would return `"245.67"` as the median price.

## Supported Data

Any token supported by the Jupiter Lite API that has a valid Solana contract address.