const crypto = require('crypto')
const { ethers } = require('hardhat')
const BigNumber = ethers.BigNumber
const { poseidon } = require('circomlib')

const poseidonHash = (items) => BigNumber.from(poseidon(items).toString())
const poseidonHash2 = (a, b) => poseidonHash([a, b])

const FIELD_SIZE = BigNumber.from(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617',
)

/** Generate random number of specified byte length */
const randomBN = (nbytes = 31) => BigNumber.from(crypto.randomBytes(nbytes))

function getExtDataHash({
  tokenAddress,
  tokenId,
  recipient,
  encryptedOutput,
  swapToken,
  swapAmount,
  swapSender,
  swapRecipient,
}) {
  const abi = new ethers.utils.AbiCoder()

  const encodedData = abi.encode(
    [
      'tuple(address tokenAddress,uint256 tokenId,address recipient,bytes encryptedOutput,address swapToken,uint256 swapAmount,address swapSender,address swapRecipient)',
    ],
    [
      {
        tokenAddress: toFixedHex(tokenAddress, 20),
        tokenId: toFixedHex(tokenId),
        recipient: toFixedHex(recipient, 20),
        encryptedOutput: encryptedOutput,
        swapToken: toFixedHex(swapToken, 20),
        swapAmount: toFixedHex(swapAmount),
        swapSender: toFixedHex(swapSender, 20),
        swapRecipient: toFixedHex(swapRecipient, 20),
      },
    ],
  )
  const hash = ethers.utils.keccak256(encodedData)
  return BigNumber.from(hash).mod(FIELD_SIZE)
}

function getTokenHash(address, id) {
  const abi = new ethers.utils.AbiCoder()

  const encodedData = abi.encode(
    ['tuple(address addr,int256 id)'],
    [
      {
        addr: toFixedHex(address, 20),
        id: toFixedHex(id),
      },
    ],
  )
  const hash = ethers.utils.keccak256(encodedData)
  return BigNumber.from(hash).mod(FIELD_SIZE)
}

/** BigNumber to hex string of specified length */
function toFixedHex(number, length = 32) {
  let result =
    '0x' +
    (number instanceof Buffer
      ? number.toString('hex')
      : BigNumber.from(number).toHexString().replace('0x', '')
    ).padStart(length * 2, '0')
  if (result.indexOf('-') > -1) {
    result = '-' + result.replace('-', '')
  }
  return result
}

/** Convert value into buffer of specified byte length */
const toBuffer = (value, length) =>
  Buffer.from(
    BigNumber.from(value)
      .toHexString()
      .slice(2)
      .padStart(length * 2, '0'),
    'hex',
  )

module.exports = {
  FIELD_SIZE,
  randomBN,
  toFixedHex,
  toBuffer,
  poseidonHash,
  poseidonHash2,
  getExtDataHash,
  getTokenHash,
}
