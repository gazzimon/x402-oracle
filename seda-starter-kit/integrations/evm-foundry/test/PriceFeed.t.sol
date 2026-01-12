// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Test } from "forge-std/Test.sol";
import { PriceFeed } from "../src/PriceFeed.sol";
import { MockSedaCore } from "@seda-protocol/evm/contracts/mocks/MockSedaCore.sol";
import { SedaDataTypes } from "@seda-protocol/evm/contracts/libraries/SedaDataTypes.sol";

contract PriceFeedTest is Test {
    PriceFeed public priceFeed;
    MockSedaCore public mockCore;
    bytes32 public constant ORACLE_PROGRAM_ID = bytes32(0);

    function setUp() public {
        // Deploy MockSedaCore
        mockCore = new MockSedaCore();

        // Deploy PriceFeed contract
        priceFeed = new PriceFeed(address(mockCore), ORACLE_PROGRAM_ID);
    }

    /**
     * Test Case 1: No transmission before `latestAnswer`
     * Ensure that calling latestAnswer without transmitting a data request first reverts.
     */
    function test_RevertIfDataRequestNotTransmitted() public {
        // Attempting to call latestAnswer without a transmission should revert
        vm.expectRevert(PriceFeed.RequestNotTransmitted.selector);
        priceFeed.latestAnswer();
    }

    /**
     * Test Case 2: No data result found
     * Ensure that calling latestAnswer after transmission but without setting a data result reverts.
     */
    function test_RevertIfDataResultNotFound() public {
        // Transmit the data request (but no result set)
        priceFeed.transmit(0, 0, 0);

        // latestAnswer should revert due to no data result being set
        vm.expectRevert();
        priceFeed.latestAnswer();
    }

    /**
     * Test Case 3: Return correct `latestAnswer` with consensus (true)
     * Verify that latestAnswer returns the correct value when consensus is reached.
     */
    function test_ReturnCorrectLatestAnswerWithConsensus() public {
        // Transmit a data request
        priceFeed.transmit(0, 0, 0);
        bytes32 dataRequestId = priceFeed.requestId();

        // Set a data result with consensus in the contract
        uint128 resultValue = 245_230_000; // Mock value
        bytes memory resultBytes = abi.encodePacked(resultValue);

        SedaDataTypes.Result memory result = SedaDataTypes.Result({
            version: "0.0.1",
            drId: dataRequestId,
            consensus: true,
            exitCode: 0,
            result: resultBytes,
            blockHeight: 0,
            blockTimestamp: uint64(block.timestamp + 3600),
            gasUsed: 0,
            paybackAddress: abi.encodePacked(address(0)),
            sedaPayload: abi.encodePacked(bytes32(0))
        });

        mockCore.postResult(result, 0, new bytes32[](0));

        // latestAnswer should return the expected result when consensus is reached
        uint128 latestAnswer = priceFeed.latestAnswer();
        assertEq(latestAnswer, resultValue);
    }

    /**
     * Test Case 4: Return zero if no consensus reached
     * Ensure that latestAnswer returns 0 when no consensus is reached.
     */
    function test_ReturnZeroIfNoConsensus() public {
        // Transmit a data request
        priceFeed.transmit(0, 0, 0);
        bytes32 dataRequestId = priceFeed.requestId();

        // Set a data result without consensus (false)
        uint128 resultValue = 100; // Mock value
        bytes memory resultBytes = abi.encodePacked(resultValue);

        SedaDataTypes.Result memory result = SedaDataTypes.Result({
            version: "0.0.1",
            drId: dataRequestId,
            consensus: false,
            exitCode: 0,
            result: resultBytes,
            blockHeight: 0,
            blockTimestamp: uint64(block.timestamp + 3600),
            gasUsed: 0,
            paybackAddress: abi.encodePacked(address(0)),
            sedaPayload: abi.encodePacked(bytes32(0))
        });

        mockCore.postResult(result, 0, new bytes32[](0));

        // latestAnswer should return 0 since no consensus was reached
        uint128 latestAnswer = priceFeed.latestAnswer();
        assertEq(latestAnswer, 0);
    }

    /**
     * Test Case 5: Successful transmission
     * Ensure that a data request is correctly transmitted and the request ID is valid.
     */
    function test_SuccessfulTransmission() public {
        // Assert data request id is zero initially
        bytes32 dataRequestId = priceFeed.requestId();
        assertEq(dataRequestId, bytes32(0));

        // Call the transmit function
        priceFeed.transmit(0, 0, 0);

        // Check that the data request ID is valid and stored correctly
        dataRequestId = priceFeed.requestId();
        assertTrue(dataRequestId != bytes32(0));
    }

    /**
     * Test Case 6: Test with different fee values
     * Ensure that transmit works with various fee combinations.
     */
    function test_TransmitWithDifferentFees() public {
        uint256 requestFee = 1000;
        uint256 resultFee = 2000;
        uint256 batchFee = 500;
        uint256 totalFee = requestFee + resultFee + batchFee;

        // Call transmit with specific fees and send ETH
        bytes32 dataRequestId = priceFeed.transmit{ value: totalFee }(requestFee, resultFee, batchFee);

        // Verify the request ID is set
        assertTrue(dataRequestId != bytes32(0));
        assertEq(priceFeed.requestId(), dataRequestId);
    }

    /**
     * Test Case 7: Test with exit code != 0
     * Ensure that latestAnswer returns 0 when exit code is not 0.
     */
    function test_ReturnZeroWithNonZeroExitCode() public {
        // Transmit a data request
        priceFeed.transmit(0, 0, 0);
        bytes32 dataRequestId = priceFeed.requestId();

        // Set a data result with consensus but non-zero exit code
        uint128 resultValue = 12_345;
        bytes memory resultBytes = abi.encodePacked(resultValue);

        SedaDataTypes.Result memory result = SedaDataTypes.Result({
            version: "0.0.1",
            drId: dataRequestId,
            consensus: true,
            exitCode: 1, // Non-zero exit code
            result: resultBytes,
            blockHeight: 0,
            blockTimestamp: uint64(block.timestamp + 3600),
            gasUsed: 0,
            paybackAddress: abi.encodePacked(address(0)),
            sedaPayload: abi.encodePacked(bytes32(0))
        });

        mockCore.postResult(result, 0, new bytes32[](0));

        // latestAnswer should return 0 since exit code is not 0
        uint128 latestAnswer = priceFeed.latestAnswer();
        assertEq(latestAnswer, 0);
    }
}
