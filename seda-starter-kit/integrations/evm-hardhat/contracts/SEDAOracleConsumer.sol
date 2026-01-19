// SPDX-License-Identifier: MIT
/**
 * NOTICE: Example contract for Cronos EVM consuming relayed SEDA results.
 * This is for MVP/demo use and does NOT verify cryptographic proofs.
 */

pragma solidity 0.8.28;

/**
 * @title SEDAOracleConsumer
 * @notice Optimistic + finality consumer for relayed SEDA results.
 * @dev Relayer-trusted model for MVP. Proof validation can be added later.
 */
contract SEDAOracleConsumer {
    /// @notice Immutable SEDA oracle program id (bytes32)
    bytes32 public immutable oracleProgramId;

    /// @notice Authorized relayer address
    address public relayer;

    /// @notice Contract owner
    address public owner;

    enum State {
        None,
        Proposed,
        Finalized,
        ConsensusError
    }

    struct Request {
        bytes32 pair;
        int256[4] proposedValue;
        int256[4] sedaValue;
        uint256 proposedAt;
        address proposer;
        State state;
        bytes apiRef;
        bytes sedaRef;
    }

    /// @notice Minimum time before finalize is allowed (seconds)
    uint256 public minFinalizationDelay;

    /// @notice Maximum window to finalize after propose (seconds)
    uint256 public finalizationWindow;

    /// @notice Latest values per pair (int256[4], 1e6 scale)
    mapping(bytes32 => int256[4]) public latestByPair;

    /// @notice Latest request id per pair
    mapping(bytes32 => bytes32) public lastRequestIdByPair;

    /// @notice Requests by id
    mapping(bytes32 => Request) public requests;

    error NotOwner();
    error NotRelayer();
    error InvalidState();
    error TooEarly();
    error TooLate();

    event Proposed(
        bytes32 indexed requestId,
        bytes32 indexed pair,
        int256[4] value,
        address indexed proposer,
        uint256 proposedAt,
        bytes apiRef
    );
    event Finalized(bytes32 indexed requestId, bytes32 indexed pair, int256[4] value, bytes sedaRef);
    event ConsensusError(
        bytes32 indexed requestId,
        bytes32 indexed pair,
        int256[4] proposedValue,
        int256[4] sedaValue,
        bytes sedaRef
    );
    event RelayerUpdated(address indexed relayer);
    event FinalizationParamsUpdated(uint256 minFinalizationDelay, uint256 finalizationWindow);

    constructor(bytes32 _oracleProgramId, address _relayer, uint256 _minFinalizationDelay, uint256 _finalizationWindow) {
        oracleProgramId = _oracleProgramId;
        relayer = _relayer;
        owner = msg.sender;
        minFinalizationDelay = _minFinalizationDelay;
        finalizationWindow = _finalizationWindow;
    }

    function setRelayer(address _relayer) external {
        if (msg.sender != owner) revert NotOwner();
        relayer = _relayer;
        emit RelayerUpdated(_relayer);
    }

    /**
     * @notice Propose a result (preview only).
     */
    /// values[0] = fair_price (1e6)
    /// values[1] = confidence_score (1e6)
    /// values[2] = max_safe_execution_size (1e6)
    /// values[3] = flags (bitmask: bit0 = CRITICAL_DIVERGENCE, bit1 = LOW_LIQUIDITY, bit2 = UNSAFE_CONFIDENCE)
    function propose(bytes32 requestId, bytes32 pair, int256[4] calldata values, bytes calldata apiRef) external {
        if (msg.sender != relayer) revert NotRelayer();
        Request storage req = requests[requestId];
        State current = req.state;
        if (!(current == State.None || current == State.ConsensusError)) revert InvalidState();

        req.pair = pair;
        req.proposedValue = values;
        req.sedaValue[0] = 0;
        req.sedaValue[1] = 0;
        req.sedaValue[2] = 0;
        req.sedaValue[3] = 0;
        req.proposedAt = block.timestamp;
        req.proposer = msg.sender;
        req.state = State.Proposed;
        req.apiRef = apiRef;
        req.sedaRef = "";

        emit Proposed(requestId, pair, values, msg.sender, block.timestamp, apiRef);
    }

    /**
     * @notice Finalize a proposed result with SEDA consensus output.
     * @dev Only allows finalize within [minFinalizationDelay, finalizationWindow].
     */
    function finalize(
        bytes32 requestId,
        int256[4] calldata sedaValue,
        bytes calldata sedaRef,
        bool consensus
    ) external {
        if (msg.sender != relayer) revert NotRelayer();
        Request storage req = requests[requestId];
        if (req.state != State.Proposed) revert InvalidState();

        uint256 elapsed = block.timestamp - req.proposedAt;
        if (elapsed < minFinalizationDelay) revert TooEarly();
        if (elapsed > finalizationWindow) revert TooLate();

        req.sedaValue = sedaValue;
        req.sedaRef = sedaRef;

        if (!consensus) {
            req.state = State.ConsensusError;
            emit ConsensusError(requestId, req.pair, req.proposedValue, sedaValue, sedaRef);
            return;
        }

        if (sedaValue[0] != req.proposedValue[0] ||
            sedaValue[1] != req.proposedValue[1] ||
            sedaValue[2] != req.proposedValue[2] ||
            sedaValue[3] != req.proposedValue[3]) {
            req.state = State.ConsensusError;
            emit ConsensusError(requestId, req.pair, req.proposedValue, sedaValue, sedaRef);
            return;
        }

        req.state = State.Finalized;
        latestByPair[req.pair] = req.proposedValue;
        lastRequestIdByPair[req.pair] = requestId;
        emit Finalized(requestId, req.pair, req.proposedValue, sedaRef);
    }

    function setFinalizationParams(uint256 _minFinalizationDelay, uint256 _finalizationWindow) external {
        if (msg.sender != owner) revert NotOwner();
        minFinalizationDelay = _minFinalizationDelay;
        finalizationWindow = _finalizationWindow;
        emit FinalizationParamsUpdated(_minFinalizationDelay, _finalizationWindow);
    }

    function getFinal(bytes32 requestId) external view returns (int256[4] memory) {
        Request storage req = requests[requestId];
        if (req.state != State.Finalized) revert InvalidState();
        return req.proposedValue;
    }

    function getProposed(bytes32 requestId)
        external
        view
        returns (int256[4] memory value, uint256 proposedAt, bytes32 pair, State state)
    {
        Request storage req = requests[requestId];
        return (req.proposedValue, req.proposedAt, req.pair, req.state);
    }

    function getLatest(bytes32 pair) external view returns (int256[4] memory) {
        return latestByPair[pair];
    }

    function getLatestRequestId(bytes32 pair) external view returns (bytes32) {
        return lastRequestIdByPair[pair];
    }
}
