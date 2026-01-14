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

    /// @notice Latest value per pair (scaled uint)
    mapping(bytes32 => uint256) public prices;

    /// @notice Last update timestamp per pair
    mapping(bytes32 => uint256) public lastUpdate;

    /// @notice Request ids already processed
    mapping(bytes32 => bool) public seenRequest;

    error NotOwner();
    error NotRelayer();
    error InvalidProof();
    error AlreadyProcessed();

    event ResultSubmitted(bytes32 indexed requestId, bytes32 indexed pair, uint256 value);
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
    function submitResult(
        bytes32 requestId,
        bytes32 pair,
        uint256 value,
        bytes calldata sedaProof
    ) external {
        if (msg.sender != relayer) revert NotRelayer();
        if (seenRequest[requestId]) revert AlreadyProcessed();

        if (sedaProof.length > 0) {
            bytes32 proofId = abi.decode(sedaProof, (bytes32));
            if (proofId != oracleProgramId) revert InvalidProof();
        }

        seenRequest[requestId] = true;
        prices[pair] = value;
        lastUpdate[pair] = block.timestamp;

        emit ResultSubmitted(requestId, pair, value);
    }

    function getPrice(bytes32 pair) external view returns (uint256) {
        return prices[pair];
    }
}
