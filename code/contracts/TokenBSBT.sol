// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title 42 Sabartho Token B (SBT)
/// @notice ERC-20 pédagogique déployé sur Sepolia. L'owner peut minter.
/// @dev OpenZeppelin fournit transfer / approve / transferFrom et le modifier onlyOwner.
contract SabarthoTokenB is ERC20, Ownable {

    /// @param initialSupply Quantité d'unités entières (ex: 1_000_000). Convertie en wei-token (18 decimals).
    /// @dev msg.sender devient owner (Ownable) et reçoit tout le supply initial.
    constructor(uint256 initialSupply) ERC20("42 Sabartho Token B", "SBTB") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }

    /// @notice Crée de nouveaux tokens. Réservé à l'owner (onlyOwner).
    /// @param to Destinataire
    /// @param amount Quantité en plus petite unité (18 decimals), pas en tokens "humains"
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
