# SEDA Foundry Integration

[![Foundry](https://img.shields.io/badge/Built%20with-Foundry-FFDB1C.svg?style=flat&logo=foundry)](https://book.getfoundry.sh/)
[![Solidity](https://img.shields.io/badge/Solidity-^0.8.28-blue.svg?style=flat&logo=solidity)](https://soliditylang.org/)

A starter kit for connecting SEDA Oracle Programs to EVM-compatible blockchains using Foundry. This integration features a **PriceFeed contract** that demonstrates how to create and retrieve data requests from the SEDA network.

> [!IMPORTANT]
> The **PriceFeed contract is an example** designed for educational purposes. It demonstrates basic SEDA integration patterns but should be modified for production use.

## Prerequisites

Before using this integration, you must:

1. **Deploy an Oracle Program** to the SEDA network (see the [main README](../../README.md))
2. **Get your Oracle Program ID** from the deployment
3. **Set up your environment** with the required variables

## Quick Start

### 1. Install Dependencies

```bash
# Install Foundry dependencies
forge install

# Build contracts
forge build

# Run tests
forge test
```

### 2. Environment Setup

Create a `.env` file with the required variables:

```bash
# Copy the example file
cp .env.example .env
```

Set up your account to use for broadcasting transactions, check the [Foundry documentation](https://getfoundry.sh/guides/best-practices/key-management) for more best practices on how to manage your keys.

In this README we will assume a wallet called "CAST_WALLET" has been imported into `cast` using the `cast wallet import --private-key 0x... CAST_WALLET` command.

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `ORACLE_PROGRAM_ID` | SEDA Oracle Program ID (bytes32) | `0x...` |

#### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CORE_ADDRESS` | SEDA Core contract address | Deploy MockSedaCore |
| `PRICEFEED_ADDRESS` | Deployed PriceFeed address | None |
| `REQUEST_FEE` | Request fee in wei | `0` |
| `RESULT_FEE` | Result fee in wei | `0` |
| `BATCH_FEE` | Batch fee in wei | `0` |

### 3. Deploy the PriceFeed Contract

> [!IMPORTANT]
> You must deploy the PriceFeed contract before you can create data requests. This is a destination contract that interacts with your deployed Oracle Program.

```bash
# Deploy to Base Sepolia
forge script script/Deploy.s.sol:Deploy --rpc-url baseSepolia --broadcast --verify --account CAST_WALLET --sender cast_wallet_address

# Deploy with custom SEDA Core address
CORE_ADDRESS=0x... forge script script/Deploy.s.sol:Deploy --rpc-url baseSepolia --broadcast --account CAST_WALLET --sender cast_wallet_address
```

### 4. Interact with Your Contract

**Create a Data Request:**
```bash
# Transmit with default fees
PRICEFEED_ADDRESS=0x... forge script script/Transmit.s.sol:Transmit --rpc-url baseSepolia --broadcast --account CAST_WALLET --sender cast_wallet_address

# Transmit with custom fees
PRICEFEED_ADDRESS=0x... REQUEST_FEE=1000000000000000 RESULT_FEE=2000000000000000 BATCH_FEE=500000000000000 forge script script/Transmit.s.sol:Transmit --rpc-url baseSepolia --broadcast --account CAST_WALLET --sender cast_wallet_address
```

**Fetch the Latest Result:**
```bash
PRICEFEED_ADDRESS=0x... forge script script/Latest.s.sol:Latest --rpc-url baseSepolia
```

## Understanding the Integration

### Oracle Program vs Destination Contract

- **Oracle Program** (Rust/WASM): Fetches data from external sources and processes it
- **Destination Contract** (Solidity): Requests data from the Oracle Program and uses the results

The PriceFeed contract is a **destination contract** that:
1. Creates data requests on the SEDA network using your Oracle Program
2. Retrieves processed results from the Oracle Program
3. Makes the data available to other smart contracts

### Example Flow

1. **Deploy Oracle Program** → Get `ORACLE_PROGRAM_ID`
2. **Deploy PriceFeed Contract** → Uses the `ORACLE_PROGRAM_ID`
3. **Call `transmit()`** → Creates a data request on SEDA network
4. **Call `latestAnswer()`** → Retrieves the processed result

## Testing

```bash
# Run all tests
forge test

# Run with gas reporting
forge test --gas-report

# Run specific test
forge test --match-test test_ReturnCorrectLatestAnswerWithConsensus
```

## Development

```bash
# Format code
forge fmt

# Lint code
forge lint

# Generate gas snapshots
forge snapshot
```

## Next Steps

For advanced topics, different oracle programs, and customization ideas, see the [main integrations README](../README.md#whats-next).

## Resources

- [SEDA Protocol Documentation](https://docs.seda.xyz)
- [Foundry Documentation](https://book.getfoundry.sh)
- [Solidity Documentation](https://docs.soliditylang.org)
- [Building Oracle Programs Guide](https://docs.seda.xyz/home/for-developers/building-an-oracle-program)
- [SEDA SDK Documentation](https://github.com/sedaprotocol/seda-sdk)
