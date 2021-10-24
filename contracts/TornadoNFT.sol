// https://tornado.cash
/*
 * d888888P                                           dP              a88888b.                   dP
 *    88                                              88             d8'   `88                   88
 *    88    .d8888b. 88d888b. 88d888b. .d8888b. .d888b88 .d8888b.    88        .d8888b. .d8888b. 88d888b.
 *    88    88'  `88 88'  `88 88'  `88 88'  `88 88'  `88 88'  `88    88        88'  `88 Y8ooooo. 88'  `88
 *    88    88.  .88 88       88    88 88.  .88 88.  .88 88.  .88 dP Y8.   .88 88.  .88       88 88    88
 *    dP    `88888P' dP       dP    dP `88888P8 `88888P8 `88888P' 88  Y88888P' `88888P8 `88888P' dP    dP
 * ooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo
 */

// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "hardhat/console.sol";

interface IVerifier {
  function verifyProof(bytes memory _proof, uint256[7] memory _input) external view returns (bool);
}

contract TornadoNFT {
  using SafeERC20 for IERC20;
  // using SafeERC721 for IERC721;

  uint256 public constant FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
  IVerifier public immutable verifier;

  mapping(bytes32 => bool) public nullifierHashes;
  bytes32 public currentRoot;
  uint256 public currentCommitmentIndex;

  struct ExtData {
    IERC721 tokenAddress;
    uint256 tokenId;
    address recipient;
    bytes encryptedOutput;
    
    // data used for private token sell
    IERC20 swapToken;
    uint256 swapAmount;
    address swapSender;
    address swapRecipient;
  }

  struct Proof {
    bytes proof;
    bytes32 root;
    bytes32 newRoot;
    bytes32 tokenHash;
    bytes32 extDataHash;
    bytes32 inputNullifier;
    bytes32 outputCommitment;
    uint256 outPathIndices;
  }

  event NewCommitment(bytes32 commitment, uint256 index, bytes encryptedOutput);
  event NewNullifier(bytes32 nullifier);

  /**
    @dev The constructor
    @param _verifier the address of SNARK verifier
  */
  constructor(IVerifier _verifier, bytes32 _zeroRoot) {
    verifier = _verifier;
    currentRoot = _zeroRoot;
  }

  function transaction(Proof calldata _args, ExtData calldata _extData) public payable {
    require(currentRoot == _args.root || _args.outputCommitment == bytes32(0), "Invalid merkle root");
    require(!isSpent(_args.inputNullifier), "Input is already spent");
    require(uint256(_args.extDataHash) == uint256(keccak256(abi.encode(_extData))) % FIELD_SIZE, "Incorrect external data hash");
    require(_args.outPathIndices == currentCommitmentIndex, "Invalid merkle tree insert position");
    require(
      verifier.verifyProof(
        _args.proof,
        [
          uint256(_args.root),
          uint256(_args.newRoot),
          uint256(_args.tokenHash),
          uint256(_args.extDataHash),
          uint256(_args.inputNullifier),
          uint256(_args.outputCommitment),
          _args.outPathIndices
        ]
      ),
      "Invalid transaction proof"
    );

    if (_args.inputNullifier == bytes32(0)) {
      // deposit
      require(
        uint256(_args.tokenHash) == uint256(keccak256(abi.encode(_extData.tokenAddress, _extData.tokenId))) % FIELD_SIZE,
        "Incorrect token hash"
      );
      _extData.tokenAddress.transferFrom(msg.sender, address(this), _extData.tokenId);
      currentRoot = _args.newRoot;
      emit NewCommitment(_args.outputCommitment, currentCommitmentIndex++, _extData.encryptedOutput);
    } else if (_args.outputCommitment == bytes32(0)) {
      // withdraw
      nullifierHashes[_args.inputNullifier] = true;
      emit NewNullifier(_args.inputNullifier);
      require(
        uint256(_args.tokenHash) == uint256(keccak256(abi.encode(_extData.tokenAddress, _extData.tokenId))) % FIELD_SIZE,
        "Incorrect token hash"
      );
      _extData.tokenAddress.safeTransferFrom(address(this), _extData.recipient, _extData.tokenId);
    } else {
      // tranfer
      if (_extData.swapToken != IERC20(address(0)) && _extData.swapAmount > 0 && _extData.swapRecipient != address(0)) {
        require(msg.sender == _extData.swapSender, "Invalid swap sender");
        _extData.swapToken.safeTransferFrom(_extData.swapSender, _extData.swapRecipient, _extData.swapAmount);
      }

      currentRoot = _args.newRoot;
      emit NewCommitment(_args.outputCommitment, currentCommitmentIndex++, _extData.encryptedOutput);
      nullifierHashes[_args.inputNullifier] = true;
      emit NewNullifier(_args.inputNullifier);
    }
  }

  /** @dev whether a note is already spent */
  function isSpent(bytes32 _nullifierHash) public view returns (bool) {
    return nullifierHashes[_nullifierHash];
  }
}
