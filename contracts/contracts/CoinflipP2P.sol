// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @title Peer-to-peer Coinflip Escrow with Commit-Reveal
/// @notice Minimal draft: holds funds for two players, verifies commit-reveal, settles deterministically.
contract CoinflipP2P {
    struct MatchData {
        address p1;
        address p2;
        uint256 wager;
        bytes32 commit1;
        bytes32 commit2;
        bytes32 seed1;
        bytes32 seed2;
        uint64 commitDeadline;
        uint64 revealDeadline;
        bool settled;
    }

    event MatchCreated(uint256 indexed id, address indexed p1, uint256 wager);
    event Joined(uint256 indexed id, address indexed p2);
    event Committed(uint256 indexed id, address indexed player, bytes32 commit);
    event Revealed(uint256 indexed id, address indexed player, bytes32 seed);
    event Settled(uint256 indexed id, address indexed winner, uint256 amount);

    uint64 public constant COMMIT_WINDOW = 15 minutes;
    uint64 public constant REVEAL_WINDOW = 15 minutes;

    uint256 public nextId = 1;
    mapping(uint256 => MatchData) public matches;

    function createMatch() external payable returns (uint256 id) {
        require(msg.value > 0, "Wager required");
        id = nextId++;
        MatchData storage m = matches[id];
        m.p1 = msg.sender;
        m.wager = msg.value;
        emit MatchCreated(id, msg.sender, msg.value);
    }

    function joinMatch(uint256 id) external payable {
        MatchData storage m = matches[id];
        require(m.p1 != address(0), "No match");
        require(m.p2 == address(0), "Full");
        require(msg.value == m.wager, "Wager mismatch");
        m.p2 = msg.sender;
        m.commitDeadline = uint64(block.timestamp) + COMMIT_WINDOW;
        emit Joined(id, msg.sender);
    }

    function commit(uint256 id, bytes32 commitHash) external {
        MatchData storage m = matches[id];
        require(m.p2 != address(0), "Waiting for join");
        require(block.timestamp <= m.commitDeadline, "Commit over");
        if (msg.sender == m.p1) {
            require(m.commit1 == bytes32(0), "P1 committed");
            m.commit1 = commitHash;
        } else if (msg.sender == m.p2) {
            require(m.commit2 == bytes32(0), "P2 committed");
            m.commit2 = commitHash;
        } else revert("Not player");
        if (m.commit1 != bytes32(0) && m.commit2 != bytes32(0) && m.revealDeadline == 0) {
            m.revealDeadline = uint64(block.timestamp) + REVEAL_WINDOW;
        }
        emit Committed(id, msg.sender, commitHash);
    }

    function reveal(uint256 id, bytes32 seed) external {
        MatchData storage m = matches[id];
        require(m.revealDeadline != 0 && block.timestamp <= m.revealDeadline, "Reveal over");
        if (msg.sender == m.p1) {
            require(m.seed1 == bytes32(0), "P1 revealed");
            require(keccak256(abi.encodePacked(seed)) == m.commit1, "Bad reveal");
            m.seed1 = seed;
        } else if (msg.sender == m.p2) {
            require(m.seed2 == bytes32(0), "P2 revealed");
            require(keccak256(abi.encodePacked(seed)) == m.commit2, "Bad reveal");
            m.seed2 = seed;
        } else revert("Not player");
        emit Revealed(id, msg.sender, seed);
    }

    function settle(uint256 id) public {
        MatchData storage m = matches[id];
        require(!m.settled, "Settled");
        address winner;
        if (m.seed1 != bytes32(0) && m.seed2 != bytes32(0)) {
            bytes32 h = keccak256(abi.encodePacked(id, m.seed1, m.seed2));
            winner = (uint8(h[31]) & 1) == 0 ? m.p1 : m.p2;
        } else if (m.revealDeadline != 0 && block.timestamp > m.revealDeadline) {
            // Timeout: whoever revealed wins, otherwise refund p1
            if (m.seed1 != bytes32(0)) winner = m.p1;
            else if (m.seed2 != bytes32(0)) winner = m.p2;
            else winner = m.p1;
        } else if (m.commitDeadline != 0 && block.timestamp > m.commitDeadline) {
            // Commit timeout: whoever committed wins, otherwise refund p1
            if (m.commit1 != bytes32(0) && m.commit2 == bytes32(0)) winner = m.p1;
            else if (m.commit2 != bytes32(0) && m.commit1 == bytes32(0)) winner = m.p2;
            else winner = m.p1;
        } else {
            revert("Not ready");
        }
        m.settled = true;
        uint256 amount = address(this).balance >= m.wager * 2 ? m.wager * 2 : address(this).balance;
        (bool ok, ) = winner.call{value: amount}("");
        require(ok, "Transfer failed");
        emit Settled(id, winner, amount);
    }
}


