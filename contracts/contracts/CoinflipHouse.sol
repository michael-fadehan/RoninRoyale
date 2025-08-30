// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @title House coinflip with single-transaction gameplay and on-chain randomness
/// @notice Players bet and get instant results in one transaction
contract CoinflipHouse {
    address public owner;
    uint256 public houseEdge = 250; // 2.5% house edge (out of 10000)
    uint256 public maxWager = 10 ether; // Maximum bet size
    uint256 public minWager = 0.01 ether; // Minimum bet size
    
    // Game statistics
    uint256 public totalGames;
    uint256 public totalWagered;
    uint256 public totalPaidOut;
    
    // Events
    event GamePlayed(
        address indexed player,
        uint256 wager,
        bool playerChoice,
        bool result,
        bool won,
        uint256 payout,
        uint256 gameId
    );
    event Funded(address indexed from, uint256 amount);
    event Withdraw(address indexed to, uint256 amount);
    event HouseEdgeUpdated(uint256 newHouseEdge);
    event WagerLimitsUpdated(uint256 newMinWager, uint256 newMaxWager);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Fund the house bankroll
    function fund() external payable {
        emit Funded(msg.sender, msg.value);
    }

    /// @notice Play coinflip in a single transaction
    /// @param choice true for heads, false for tails
    function flip(bool choice) external payable returns (bool won, uint256 payout) {
        require(msg.value >= minWager, "wager too low");
        require(msg.value <= maxWager, "wager too high");
        
        // Ensure house has enough funds to pay potential winnings
        uint256 potentialPayout = (msg.value * 2 * (10000 - houseEdge)) / 10000;
        require(address(this).balance >= potentialPayout, "insufficient house funds");
        
        // Generate pseudo-random result using on-chain data
        // Note: This is not cryptographically secure but sufficient for gaming
        bool result = _generateRandomResult();
        
        // Determine if player won
        won = (choice == result);
        
        // Calculate payout
        if (won) {
            payout = potentialPayout;
            // Pay the player
            (bool success,) = payable(msg.sender).call{value: payout}("");
            require(success, "payout failed");
            totalPaidOut += payout;
        } else {
            payout = 0;
            // House keeps the wager (already received via msg.value)
        }
        
        // Update statistics
        totalGames++;
        totalWagered += msg.value;
        
        // Emit event
        emit GamePlayed(msg.sender, msg.value, choice, result, won, payout, totalGames);
        
        return (won, payout);
    }

    /// @notice Generate pseudo-random boolean result
    /// @dev Uses block data for randomness - not cryptographically secure but sufficient for gaming
    function _generateRandomResult() private view returns (bool) {
        // Combine multiple sources of entropy
        bytes32 hash = keccak256(abi.encodePacked(
            block.timestamp,
            block.difficulty, // Use block.difficulty for Ronin compatibility
            msg.sender,
            totalGames,
            address(this).balance
        ));
        
        // Return true if last bit is 1 (heads), false if 0 (tails)
        return uint256(hash) % 2 == 1;
    }

    /// @notice Owner can withdraw funds from the house
    function withdraw(address payable to, uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "insufficient balance");
        (bool success,) = to.call{value: amount}("");
        require(success, "transfer failed");
        emit Withdraw(to, amount);
    }

    /// @notice Update house edge (only owner)
    function setHouseEdge(uint256 _houseEdge) external onlyOwner {
        require(_houseEdge <= 1000, "house edge too high"); // Max 10%
        houseEdge = _houseEdge;
        emit HouseEdgeUpdated(_houseEdge);
    }

    /// @notice Update wager limits (only owner)
    function setWagerLimits(uint256 _minWager, uint256 _maxWager) external onlyOwner {
        require(_minWager > 0, "min wager must be positive");
        require(_maxWager > _minWager, "max must be greater than min");
        minWager = _minWager;
        maxWager = _maxWager;
        emit WagerLimitsUpdated(_minWager, _maxWager);
    }

    /// @notice Get house statistics
    function getHouseStats() external view returns (
        uint256 balance,
        uint256 games,
        uint256 wagered,
        uint256 paidOut,
        uint256 houseProfit
    ) {
        return (
            address(this).balance,
            totalGames,
            totalWagered,
            totalPaidOut,
            totalWagered > totalPaidOut ? totalWagered - totalPaidOut : 0
        );
    }

    /// @notice Emergency function to transfer ownership
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "invalid address");
        owner = newOwner;
    }

    receive() external payable {
        emit Funded(msg.sender, msg.value);
    }
}


