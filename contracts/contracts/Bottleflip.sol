// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "../libs/ReentrancyGuard.sol";

/// @title Bottleflip - simple single-transaction bottle spin contract
/// @notice Players call `spin` and are paid instantly within the same transaction; uses on-chain entropy (not VRF)
contract Bottleflip is ReentrancyGuard {
    address public owner;

    // house edge in basis points (10000 = 100%). 500 => 5%
    uint256 public houseEdgeBps = 500;
    uint256 public maxWager = 10 ether;
    uint256 public minWager = 0.01 ether;

    // Stats
    uint256 public totalGames;
    uint256 public totalWagered;
    uint256 public totalPaidOut;

    event GamePlayed(address indexed player, uint256 wager, bool playerChoice, bool result, bool won, uint256 payout, uint256 gameId);
    event Funded(address indexed from, uint256 amount);
    event Withdraw(address indexed to, uint256 amount);
    event HouseEdgeUpdated(uint256 newHouseEdgeBps);
    event WagerLimitsUpdated(uint256 newMinWager, uint256 newMaxWager);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Fund the house
    function fund() external payable {
        emit Funded(msg.sender, msg.value);
    }

    /// @notice Play the bottle spin in a single transaction
    /// @param choice true = up, false = down
    function spin(bool choice) external payable nonReentrant returns (bool won, uint256 payout) {
        require(msg.value >= minWager, "wager too low");
        require(msg.value <= maxWager, "wager too high");

        // calculate potential payout: multiplier = (20000 - houseEdgeBps)/10000
        uint256 potentialPayout = (msg.value * (20000 - houseEdgeBps)) / 10000;
        require(address(this).balance >= potentialPayout, "insufficient house funds");

        // generate pseudo-random result using on-chain data
        bool result = _generateRandomResult();

        won = (choice == result);
        if (won) {
            payout = potentialPayout;
            (bool success, ) = payable(msg.sender).call{value: payout}("");
            require(success, "payout failed");
            totalPaidOut += payout;
        } else {
            payout = 0;
            // house keeps the wager
        }

        totalGames += 1;
        totalWagered += msg.value;

        emit GamePlayed(msg.sender, msg.value, choice, result, won, payout, totalGames);
        return (won, payout);
    }

    /// @dev On-chain pseudo-randomness - not secure for high-value games
    function _generateRandomResult() private view returns (bool) {
        bytes32 hash = keccak256(abi.encodePacked(block.timestamp, block.number, blockhash(block.number > 1 ? block.number - 1 : block.number), msg.sender, totalGames, address(this).balance));
        return uint256(hash) % 2 == 1;
    }

    /// @notice Owner withdraw funds
    function withdraw(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(address(this).balance >= amount, "insufficient balance");
        (bool success, ) = to.call{value: amount}("");
        require(success, "transfer failed");
        emit Withdraw(to, amount);
    }

    function setHouseEdgeBps(uint256 _houseEdgeBps) external onlyOwner {
        require(_houseEdgeBps <= 1000, "house edge too high");
        houseEdgeBps = _houseEdgeBps;
        emit HouseEdgeUpdated(_houseEdgeBps);
    }

    function setWagerLimits(uint256 _minWager, uint256 _maxWager) external onlyOwner {
        require(_minWager > 0, "min wager must be positive");
        require(_maxWager > _minWager, "max must be greater than min");
        minWager = _minWager;
        maxWager = _maxWager;
        emit WagerLimitsUpdated(_minWager, _maxWager);
    }

    function getHouseStats() external view returns (uint256 balance, uint256 games, uint256 wagered, uint256 paidOut, uint256 houseProfit) {
        return (
            address(this).balance,
            totalGames,
            totalWagered,
            totalPaidOut,
            totalWagered > totalPaidOut ? totalWagered - totalPaidOut : 0
        );
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "invalid address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    receive() external payable {
        emit Funded(msg.sender, msg.value);
    }
}


