// SPDX-License-Identifier: MIT
/**
 * NOTICE: Example contract for Cronos EVM consuming relayed SEDA results.
 * This is for MVP/demo use and does NOT verify cryptographic proofs.
 */

pragma solidity 0.8.28;

/**
 * @title SEDAOracleConsumer
 * @notice Stores relayed oracle results keyed by pair hash.
 * @dev Relayer-trusted model for MVP. Proof validation can be added later.
 */
contract SEDAOracleConsumer {
    /// @notice Immutable SEDA oracle program id (bytes32)
    bytes32 public immutable oracleProgramId;

    /// @notice Authorized relayer address
    address public relayer;

    /// @notice Contract owner
    address public owner;

    /// @notice Latest values per pair (int256[4], 1e6 scale)
    mapping(bytes32 => int256[4]) public latestByPair;

    /// @notice Latest request id per pair
    mapping(bytes32 => bytes32) public lastRequestIdByPair;

    /// @notice Request ids already processed
    mapping(bytes32 => bool) public seenRequest;

    error NotOwner();
    error NotRelayer();
    error InvalidProof();
    error AlreadyProcessed();

    event ResultSubmitted(bytes32 indexed requestId, bytes32 indexed pair, int256[4] values);
    event RelayerUpdated(address indexed relayer);

    constructor(bytes32 _oracleProgramId, address _relayer) {
        oracleProgramId = _oracleProgramId;
        relayer = _relayer;
        owner = msg.sender;
    }

    function setRelayer(address _relayer) external {
        if (msg.sender != owner) revert NotOwner();
        relayer = _relayer;
        emit RelayerUpdated(_relayer);
    }

    /**
     * @notice Submit a relayed result.
     * @dev `sedaProof` is expected to be abi.encode(oracleProgramId) for MVP.
     */
    /// values[0] = fair_price (1e6)
    /// values[1] = confidence_score (1e6)
    /// values[2] = max_safe_execution_size (1e6)
    /// values[3] = flags (bitmask: bit0 = CRITICAL_DIVERGENCE, bit1 = LOW_LIQUIDITY, bit2 = UNSAFE_CONFIDENCE)
    function submitResult(
        bytes32 requestId,
        bytes32 pair,
        int256[4] calldata values,
        bytes calldata sedaProof
    ) external {
        if (msg.sender != relayer) revert NotRelayer();
        if (seenRequest[requestId]) revert AlreadyProcessed();

        if (sedaProof.length > 0) {
            bytes32 proofId = abi.decode(sedaProof, (bytes32));
            if (proofId != oracleProgramId) revert InvalidProof();
        }

        seenRequest[requestId] = true;
        latestByPair[pair] = values;
        lastRequestIdByPair[pair] = requestId;

        emit ResultSubmitted(requestId, pair, values);
    }

    function getLatest(bytes32 pair) external view returns (int256[4] memory) {
        return latestByPair[pair];
    }

    function getLatestRequestId(bytes32 pair) external view returns (bytes32) {
        return lastRequestIdByPair[pair];
    }
}
