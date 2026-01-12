// SPDX-License-Identifier: MIT
pragma solidity >=0.8.28 <0.9.0;

import { console2 } from "forge-std/console2.sol";
import { BaseScript } from "./BaseScript.s.sol";
import { PriceFeed } from "../src/PriceFeed.sol";
import { MockSedaCore } from "@seda-protocol/evm/contracts/mocks/MockSedaCore.sol";

contract Deploy is BaseScript {
    function run() external broadcast {
        // ENV:
        // - ORACLE_PROGRAM_ID (required): bytes32
        // - CORE_ADDRESS (optional): if set, use it; else deploy MockSedaCore

        // Get Oracle Program ID (same for all networks)
        bytes32 opId = vm.envBytes32("ORACLE_PROGRAM_ID");

        // Auto-detect network and get SEDA Core address
        uint256 chainId = block.chainid;
        address core = getSedaCoreAddress(chainId);

        // If CORE_ADDRESS provided via env, use it; else use network default
        if (vm.envOr("CORE_ADDRESS", bytes("")).length > 0) {
            core = vm.envAddress("CORE_ADDRESS");
            console2.log("Using env CORE_ADDRESS:", core);
        } else {
            console2.log("Using network default CORE_ADDRESS:", core);
        }

        // Deploy MockSedaCore if no core address available
        if (core == address(0)) {
            MockSedaCore mock = new MockSedaCore();
            core = address(mock);
            console2.log("Deployed MockSedaCore:", core);
        }

        PriceFeed feed = new PriceFeed(core, opId);
        console2.log("Deployed PriceFeed:", address(feed));
        console2.log("Chain ID:", chainId);
        console2.logBytes32(opId);
    }

    function getSedaCoreAddress(uint256 chainId) internal pure returns (address) {
        if (chainId == 8453) {
            // Base Mainnet
            return 0xDF1fb5ACe711B16D90FC45776fF1bF02CEBc245D;
        } else if (chainId == 84_532) {
            // Base Sepolia
            return 0xffDB1d9bBE4D56780143428450c4C2058061E6F3;
        } else if (chainId == 10_200) {
            // Gnosis Chiado
            return 0xbe2ace709959C121759d553cACf7e6532C25a3aA;
        } else if (chainId == 12_345) {
            // Superseed Sepolia (example chain ID)
            return 0xE08989FB730E072689b4885c2a62AE5f1fc787F2;
        } else if (chainId == 999) {
            // Hyperliquid Purrsec (example chain ID)
            return 0x23c01fe3C1b7409A98bBd39a7c9e5C2263C64b59;
        } else if (chainId == 31_337) {
            // Hardhat
            // Will deploy MockSedaCore
            return address(0);
        } else {
            revert("Unknown core address for network");
        }
    }
}
