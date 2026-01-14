// SPDX-License-Identifier: MIT
/**
 * NOTICE: This is an example contract to demonstrate SEDA network functionality.
 * It is for educational purposes only and should not be used in production.
 */

pragma solidity 0.8.28;

import {ISedaCore} from "@seda-protocol/evm/contracts/interfaces/ISedaCore.sol";
import {SedaDataTypes} from "@seda-protocol/evm/contracts/libraries/SedaDataTypes.sol";

/**
 * @title PriceFeed
 * @author Open Oracle Association
 * @notice An example showing how to create and interact with SEDA network requests.
 * @dev This contract demonstrates basic SEDA request creation and result fetching.
 */
contract PriceFeed {
    /// @notice Instance of the SedaCore contract
    ISedaCore public immutable SEDA_CORE;

    /// @notice ID of the request WASM binary on the SEDA network
    bytes32 public immutable ORACLE_PROGRAM_ID;

    /// @notice ID of the most recent request
    bytes32 public requestId;

    /// @notice Last requested pair string
    string public lastPair;

    /// @notice Latest stored result per pair (scaled 1e8)
    mapping(bytes32 => uint256) public latestByPair;

    /// @notice Latest request id per pair
    mapping(bytes32 => bytes32) public requestIdByPair;

    /// @notice Thrown when trying to fetch results before any request is transmitted
    error RequestNotTransmitted();

    /// @notice Emitted when a new request is posted
    event RequestPosted(bytes32 indexed requestId);

    /**
     * @notice Sets up the contract with SEDA network parameters
     * @param _sedaCoreAddress Address of the SedaCore contract
     * @param _oracleProgramId ID of the WASM binary for handling requests
     */
    constructor(address _sedaCoreAddress, bytes32 _oracleProgramId) {
        SEDA_CORE = ISedaCore(_sedaCoreAddress);
        ORACLE_PROGRAM_ID = _oracleProgramId;
        lastPair = "WCRO-USDC";
    }

    /**
     * @notice Creates a new price request on the SEDA network
     * @dev Demonstrates how to structure and send a request to SEDA
     * @param requestFee The fee for the request
     * @param resultFee The fee for the result
     * @param batchFee The fee for the batch
     * @return The ID of the created request
     */
    function transmit(uint256 requestFee, uint256 resultFee, uint256 batchFee) external payable returns (bytes32) {
        return _transmitPair(lastPair, requestFee, resultFee, batchFee);
    }

    /**
     * @notice Creates a new price request for a specific pair
     * @param pair Pair string (e.g. "WCRO-USDC")
     * @param requestFee The fee for the request
     * @param resultFee The fee for the result
     * @param batchFee The fee for the batch
     * @return The ID of the created request
     */
    function transmitPair(
        string calldata pair,
        uint256 requestFee,
        uint256 resultFee,
        uint256 batchFee
    ) external payable returns (bytes32) {
        return _transmitPair(pair, requestFee, resultFee, batchFee);
    }

    /**
     * @notice Updates the stored latest result for a pair
     * @param pair Pair string (e.g. "WCRO-USDC")
     * @return The latest result value (scaled 1e8) or 0 on failure
     */
    function syncLatest(string calldata pair) external returns (uint256) {
        bytes32 pairKey = _pairKey(pair);
        bytes32 pairRequestId = requestIdByPair[pairKey];
        if (pairRequestId == bytes32(0)) revert RequestNotTransmitted();

        uint256 value = _readResult(pairRequestId);
        if (value != 0) {
            latestByPair[pairKey] = value;
        }
        return value;
    }

    /**
     * @notice Returns the stored latest result for a pair
     * @param pair Pair string (e.g. "WCRO-USDC")
     */
    function latest(string calldata pair) external view returns (uint256) {
        return latestByPair[_pairKey(pair)];
    }

    function _transmitPair(
        string memory pair,
        uint256 requestFee,
        uint256 resultFee,
        uint256 batchFee
    ) internal returns (bytes32) {
        SedaDataTypes.RequestInputs memory inputs = SedaDataTypes.RequestInputs(
            ORACLE_PROGRAM_ID, // execProgramId (Execution WASM binary ID)
            ORACLE_PROGRAM_ID, // tallyProgramId (same as execProgramId in this example)
            2000, // gasPrice (SEDA tokens per gas unit)
            50000000000000, // execGasLimit (within uint64 range)
            20000000000000, // tallyGasLimit (within uint64 range)
            1, // replicationFactor (number of required DR executors)
            _formatExecInputs(pair), // execInputs (Inputs for Execution WASM)
            hex"00", // tallyInputs
            hex"00", // consensusFilter (set to `None`)
            abi.encodePacked(block.number) // memo (Additional public info)
        );

        // Pass the msg.value as fees to the SEDA core
        requestId = SEDA_CORE.postRequest{value: msg.value}(inputs, requestFee, resultFee, batchFee);
        emit RequestPosted(requestId);

        lastPair = pair;
        requestIdByPair[_pairKey(pair)] = requestId;
        return requestId;
    }

    /**
     * @notice Retrieves the result of the latest request
     * @dev Shows how to fetch and interpret SEDA request results
     * @return The price as uint128, or 0 if no consensus was reached
     */
    function latestAnswer() public view returns (uint128) {
        if (requestId == bytes32(0)) revert RequestNotTransmitted();

        uint256 value = _readResult(requestId);
        if (value > type(uint128).max) {
            return 0;
        }
        return uint128(value);
    }

    function _readResult(bytes32 id) internal view returns (uint256) {
        SedaDataTypes.Result memory result = SEDA_CORE.getResult(id);
        if (!(result.consensus && result.exitCode == 0)) {
            return 0;
        }
        if (result.result.length < 32) {
            return 0;
        }
        return abi.decode(result.result, (uint256));
    }

    function _formatExecInputs(string memory pair) internal pure returns (bytes memory) {
        return abi.encodePacked('{"pair":"', pair, '"}');
    }

    function _pairKey(string memory pair) internal pure returns (bytes32) {
        return keccak256(bytes(pair));
    }
}
