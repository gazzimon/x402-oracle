// SPDX-License-Identifier: MIT
/**
 * NOTICE: Example contract for Cronos EVM consuming relayed SEDA results.
 * Minimal on-chain storage; full payload lives off-chain with cryptographic anchor.
 */

pragma solidity 0.8.28;

/**
 * @title SEDAOracleCronos
 * @notice Stores minimal relayed oracle metadata keyed by pair hash.
 * @dev Relayer-trusted MVP. Proof verification can be added later.
 */
contract SEDAOracleCronos {
    /// @notice Immutable SEDA oracle program id (bytes32)
    bytes32 public immutable oracleProgramId;

    /// @notice Authorized relayer address
    address public relayer;

    /// @notice Contract owner
    address public owner;

    /// @notice Request ids already processed
    mapping(bytes32 => bool) public seenRequest;

    /// @notice Payload hash per pair (keccak256 of payload fields)
    mapping(bytes32 => bytes32) public payloadHashByPair;

    /// @notice DR block height per pair
    mapping(bytes32 => uint64) public drBlockHeightByPair;

    error NotOwner();
    error NotRelayer();
    error InvalidProof();
    error AlreadyProcessed();
    error InvalidBlockHeight();

    event ResultSubmitted(bytes32 indexed requestId, bytes32 indexed pair, bytes32 payloadHash, uint64 drBlockHeight);
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
        int256[] calldata values,
        uint64 drBlockHeight,
        bytes calldata sedaProof
    ) external {
        if (msg.sender != relayer) revert NotRelayer();
        if (seenRequest[requestId]) revert AlreadyProcessed();
        if (drBlockHeight == 0) revert InvalidBlockHeight();

        if (sedaProof.length > 0) {
            bytes32 proofId = abi.decode(sedaProof, (bytes32));
            if (proofId != oracleProgramId) revert InvalidProof();
        }

        bytes32 payloadHash = keccak256(abi.encode(requestId, pair, values, drBlockHeight));
        seenRequest[requestId] = true;
        payloadHashByPair[pair] = payloadHash;
        drBlockHeightByPair[pair] = drBlockHeight;

        emit ResultSubmitted(requestId, pair, payloadHash, drBlockHeight);
    }
}
