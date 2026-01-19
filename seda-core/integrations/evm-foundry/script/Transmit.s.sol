// SPDX-License-Identifier: MIT
pragma solidity >=0.8.28 <0.9.0;

import { console2 } from "forge-std/console2.sol";
import { BaseScript } from "./BaseScript.s.sol";
import { PriceFeed } from "../src/PriceFeed.sol";

contract Transmit is BaseScript {
    function run() external broadcast {
        if (!vm.envExists("PRICEFEED_ADDRESS")) {
            revert("PRICEFEED_ADDRESS environment variable not set");
        }
        address feedAddr = vm.envAddress("PRICEFEED_ADDRESS");
        uint256 requestFee = vm.envOr("REQUEST_FEE", uint256(0));
        uint256 resultFee = vm.envOr("RESULT_FEE", uint256(0));
        uint256 batchFee = vm.envOr("BATCH_FEE", uint256(0));
        uint256 valueWei = requestFee + resultFee + batchFee;

        bytes32 reqId = PriceFeed(feedAddr).transmit{ value: valueWei }(requestFee, resultFee, batchFee);

        console2.log("requestId: 0x%x", uint256(reqId));
    }
}
