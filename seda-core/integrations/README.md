# SEDA Integrations

This directory contains integration examples that demonstrate how to connect your SEDA Oracle Programs to different blockchain networks.

## Overview

The SEDA Request Starter Kit includes two main components:

1. **Oracle Program** (in the root directory) - A Rust-based WASM program that fetches and processes data
2. **Destination Smart Contracts** (in this directory) - Smart contracts that interact with your deployed Oracle Program

## Available Integrations

### EVM (Ethereum Virtual Machine)

| Framework | Description | Directory |
|-----------|-------------|-----------|
| **Hardhat** | TypeScript-based development environment with comprehensive tooling | [`evm-hardhat/`](./evm-hardhat/) |
| **Foundry** | Rust-based toolkit with advanced testing and deployment capabilities | [`evm-foundry/`](./evm-foundry/) |

Both integrations feature a **PriceFeed contract** that serves as an example contract that uses SEDA data, demonstrating how to:
- Create data requests on the SEDA network
- Retrieve and process oracle results
- Handle fees and gas optimization

## Getting Started

### Step 1: Deploy Your Oracle Program

Before using any integration, you must first build and deploy an Oracle Program to the SEDA network:

```bash
# From the root directory
bun run build
bun run deploy
```

This will give you an `ORACLE_PROGRAM_ID` that you'll need for the destination contracts.

### Step 2: Choose Your Integration

Select the integration that best fits your development preferences:

- **Choose Hardhat** if you prefer TypeScript, comprehensive tooling, and detailed documentation
- **Choose Foundry** if you prefer Rust-based tooling, advanced testing, and gas optimization

### Step 3: Deploy Destination Contracts

Each integration includes deployment scripts for the example PriceFeed contract. The destination contracts must be deployed to your target EVM network (e.g., Base Sepolia, Ethereum, etc.).

## Important Notes

> [!IMPORTANT]
> The **PriceFeed contract is an example** designed for educational purposes. It demonstrates basic SEDA integration patterns but should be modified for production use.

## Understanding the Architecture

### Oracle Program vs Destination Contract

- **Oracle Program** (Rust/WASM): Defines what data to fetch, how to process it, and what format to return
- **Destination Contract** (Solidity): Defines how to request data and how to use the results

### Data Flow

1. **Destination Contract** calls `transmit()` with input parameters
2. **SEDA Network** executes the Oracle Program with those inputs
3. **Oracle Program** fetches and processes data, returns result in defined format
4. **Destination Contract** calls `latestAnswer()` to retrieve the processed result

## Customization Guide

The PriceFeed contract is designed to be modified for your specific use case:

### What's Hardcoded in the EVM Contract (for simplicity)

You can make these configurable:

- **Gas limits**: `execGasLimit` and `tallyGasLimit` (currently hardcoded to 50B and 20B)
- **Replication factor**: Number of executor nodes (currently hardcoded to 1)
- **Fees**: Request, result, and batch fees (can be made configurable)
- **Contract logic**: Access controls, validation, error handling

### What's Defined by the Oracle Program

The Oracle Program supports different trading pairs out of the box:

- **Input format**: Any trading pair in "SYMBOL-SYMBOL" format (e.g., "ETH-USDC", "BTC-USDT")
- **Data source**: Uses Binance API (can be changed to any API)
- **Processing logic**: Fetches price, converts to integer with 6 decimal precision
- **Output format**: Returns price as `uint128` (16 bytes, little-endian)
- **Error handling**: Reports errors back to SEDA network

### Example Modifications

#### Making EVM Contract Parameters Configurable

```solidity
// Make gas limits configurable
function transmit(
    uint256 requestFee, 
    uint256 resultFee, 
    uint256 batchFee,
    uint64 execGasLimit,
    uint64 tallyGasLimit
) external payable returns (bytes32) {
    // Use parameters instead of hardcoded values
}

// Add access control
modifier onlyOwner() {
    require(msg.sender == owner, "Not authorized");
    _;
}
```

#### Using Different Trading Pairs

The Oracle Program handles any "SYMBOL-SYMBOL" format. Modify the EVM contract to request different data:

```solidity
function transmitForPair(string memory pair) external payable returns (bytes32) {
    bytes memory execInputs = abi.encode(pair); // "BTC-USDT", "ETH-USDC", etc.
    // ... rest of transmit logic
}
```

#### Changing Data Sources or Output Formats

Modify the Oracle Program for different APIs or output formats:

```rust
// In src/execution_phase.rs
let response = http_fetch(
    format!("https://api.coingecko.com/api/v3/simple/price?ids={}&vs_currencies={}", 
            symbol_a, symbol_b),
    None,
);

let result = format!("{{\"price\":\"{}\",\"pair\":\"{}\"}}", price, dr_inputs_raw);
Process::success(result.as_bytes());
```

## Resources

- [SEDA Protocol Documentation](https://docs.seda.xyz)
- [Building Oracle Programs Guide](https://docs.seda.xyz/home/for-developers/building-an-oracle-program)
- [SEDA SDK Documentation](https://github.com/sedaprotocol/seda-sdk)
