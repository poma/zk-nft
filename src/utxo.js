const { ethers } = require('hardhat')
const { BigNumber } = ethers
const { randomBN, poseidonHash, toBuffer, getTokenHash: tokenHash } = require('./utils')
const { Keypair } = require('./keypair')

class Utxo {
  /** Initialize a new UTXO - unspent transaction output or input. Note, a full TX consists of 2/16 inputs and 2 outputs
   *
   * @param {BigNumberish} amount UTXO amount
   * @param {BigNumberish} blinding Blinding factor
   * @param {Keypair} keypair
   * @param {number|null} index UTXO index in the merkle tree
   */
  constructor({
    tokenAddress = 0,
    tokenId = 0,
    keypair = new Keypair(),
    blinding = randomBN(),
    index = null,
  } = {}) {
    this.tokenAddress = BigNumber.from(tokenAddress)
    this.tokenId = BigNumber.from(tokenId)
    this.blinding = BigNumber.from(blinding)
    this.keypair = keypair
    this.index = index
  }

  getTokenHash() {
    return this.tokenAddress.eq(0) ? BigNumber.from(0) : tokenHash(this.tokenAddress, this.tokenId)
  }

  /**
   * Returns commitment for this UTXO
   *
   * @returns {BigNumber}
   */
  getCommitment() {
    if (!this._commitment) {
      this._commitment = this.tokenAddress.eq(0)
        ? BigNumber.from(0)
        : poseidonHash([this.getTokenHash(), this.keypair.pubkey, this.blinding])
    }
    return this._commitment
  }

  /**
   * Returns nullifier for this UTXO
   *
   * @returns {BigNumber}
   */
  getNullifier() {
    if (!this._nullifier) {
      if (
        !this.tokenAddress.eq(0) &&
        (this.index === undefined ||
          this.index === null ||
          this.keypair.privkey === undefined ||
          this.keypair.privkey === null)
      ) {
        throw new Error('Can not compute nullifier without utxo index or private key')
      }
      this._nullifier = this.tokenAddress.eq(0)
        ? BigNumber.from(0)
        : poseidonHash([this.getCommitment(), this.index || 0, this.keypair.privkey || 0])
    }
    return this._nullifier
  }

  /**
   * Encrypt UTXO data using the current keypair
   *
   * @returns {string} `0x`-prefixed hex string with data
   */
  encrypt() {
    const bytes = Buffer.concat([
      toBuffer(this.blinding, 32),
      toBuffer(this.tokenAddress, 20),
      toBuffer(this.tokenId, 32),
    ])
    return this.keypair.encrypt(bytes)
  }

  /**
   * Decrypt a UTXO
   *
   * @param {Keypair} keypair keypair used to decrypt
   * @param {string} data hex string with data
   * @param {number} index UTXO index in merkle tree
   * @returns {Utxo}
   */
  static decrypt(keypair, data, index) {
    const buf = keypair.decrypt(data)
    return new Utxo({
      blinding: BigNumber.from('0x' + buf.slice(0, 32).toString('hex')),
      tokenAddress: BigNumber.from('0x' + buf.slice(32, 52).toString('hex')),
      tokenId: BigNumber.from('0x' + buf.slice(52, 84).toString('hex')),
      keypair,
      index,
    })
  }
}

module.exports = Utxo
