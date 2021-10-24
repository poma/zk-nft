// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract ERC721Mock is ERC721 {
  constructor() ERC721("ERC20Mock", "ERC20Mock") {}

  function mint(address to, uint256 tokenId) public {
    _mint(to, tokenId);
  }
}
