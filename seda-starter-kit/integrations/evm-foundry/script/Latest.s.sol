// SPDX-License-Identifier: MIT
pragma solidity >=0.8.28 <0.9.0;

import { console2 } from "forge-std/console2.sol";
import { BaseScript } from "./BaseScript.s.sol";
import { PriceFeed } from "../src/PriceFeed.sol";

contract Latest is BaseScript {
    function run() external view {
        if (!vm.envExists("PRICEFEED_ADDRESS")) {
            revert("PRICEFEED_ADDRESS environment variable not set");
        }

        address feedAddr = vm.envAddress("PRICEFEED_ADDRESS");
        PriceFeed feed = PriceFeed(feedAddr);

        // Get the latest price
        uint128 price = feed.latestAnswer();

        console2.log("Latest ETH-USDC price:", price);
        console2.log("PriceFeed address:", feedAddr);
        console2.log("Request ID:", vm.toString(feed.requestId()));
    }
}
