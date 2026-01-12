# Generic dxFeed

Deployments:
- [Testnet](https://testnet.explorer.seda.xyz/oracle-programs/be8032a340f1453d384b6f5de06cf6536f1dab38a96af12157efc9a16eb3d138)
<!-- - [Mainnet](https://explorer.seda.xyz/oracle-programs/) -->

## Overview

This Oracle Program gets the price of a commodity, equity, or forex pair by hitting the dxFeed API depending on the provided inputs. The API is behind a Data Proxy.

You can test this Oracle Program on testnet with the following commands:

For a commodity:

```sh
cargo post-dr generic-dxfeed commodity BRN/USD -i be8032a340f1453d384b6f5de06cf6536f1dab38a96af12157efc9a16eb3d138 --gas-price 4000 --exec-gas-limit 900000000000000 -r 3
```

For a equity:

```sh
cargo post-dr generic-dxfeed equity AAPL -i be8032a340f1453d384b6f5de06cf6536f1dab38a96af12157efc9a16eb3d138 --gas-price 4000 --exec-gas-limit 300000000000000
```

You can also do `uslf-t` or `uslf-q` for the asset name.

For a USD forex pair:

```sh
cargo post-dr generic-dxfeed fx EUR -i be8032a340f1453d384b6f5de06cf6536f1dab38a96af12157efc9a16eb3d138 --gas-price 4000 --exec-gas-limit 300000000000000
```

For a reverse USD forex pair:

```sh
cargo post-dr generic-dxfeed fx-r JPY -i be8032a340f1453d384b6f5de06cf6536f1dab38a96af12157efc9a16eb3d138 --gas-price 4000 --exec-gas-limit 300000000000000
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

#### Commodity

Input: `cfd/BRN/USD`

Output: `6717`

#### Equity

Input: `equity/AAPL`

Output: `23999`

#### Forex

Input: `fx/EUR`

Output: `117`

#### Reverse Forex

Input: `fx_r/JPY`

Output: `14741`

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

We don't have a list of supported Forex pairs at this time.

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