const hre = require('hardhat')
const { ethers, waffle } = hre
const { loadFixture } = waffle
const { expect } = require('chai')

const { poseidonHash2 } = require('../src/utils')
const Utxo = require('../src/utxo')

const MERKLE_TREE_HEIGHT = 5
const MerkleTree = require('fixed-merkle-tree')

const { transaction } = require('../src/index')
const { Keypair } = require('../src/keypair')

describe('TornadoNFT', function () {
  this.timeout(20000)

  async function deploy(contractName, ...args) {
    const Factory = await ethers.getContractFactory(contractName)
    const instance = await Factory.deploy(...args)
    return instance.deployed()
  }

  async function fixture() {
    const verifier = await deploy('Verifier')
    const tree = new MerkleTree(MERKLE_TREE_HEIGHT, [], { hashFunction: poseidonHash2 })

    /** @type {TornadoNFT} */
    const tornadoNFT = await deploy('TornadoNFT', verifier.address, tree.root())
    const erc721 = await deploy('ERC721Mock')
    const erc20 = await deploy('ERC20Mock')

    return { tornadoNFT, erc721, erc20 }
  }

  it('encrypt -> decrypt should work', () => {
    const data = Buffer.from([0xff, 0xaa, 0x00, 0x01])
    const keypair = new Keypair()

    const ciphertext = keypair.encrypt(data)
    const result = keypair.decrypt(ciphertext)
    expect(result).to.be.deep.equal(data)
  })

  it('should deposit, transact and withdraw', async function () {
    const { tornadoNFT, erc721 } = await loadFixture(fixture)
    const [, alice, bob] = await ethers.getSigners()
    const tokenId = 0xbeef
    await erc721.mint(alice.address, tokenId)

    // Alice deposits an NFT into tornado pool
    const aliceUtxo = new Utxo({ tokenAddress: erc721.address, tokenId })
    await erc721.connect(alice).approve(tornadoNFT.address, tokenId)
    await transaction({ tornadoNFT: tornadoNFT.connect(alice), output: aliceUtxo })
    expect(await erc721.ownerOf(tokenId)).to.be.equal(tornadoNFT.address)

    // Bob gives Alice address to send NFT inside the shielded pool
    const bobKeypair = new Keypair() // contains private and public keys
    const bobAddress = bobKeypair.address() // contains only public key

    // Alice sends NFT to Bob
    const bobSendUtxo = new Utxo({
      tokenAddress: erc721.address,
      tokenId,
      keypair: Keypair.fromString(bobAddress),
    })
    await transaction({ tornadoNFT, input: aliceUtxo, output: bobSendUtxo })

    // Bob parses chain to detect incoming tokens
    const filter = tornadoNFT.filters.NewCommitment()
    const fromBlock = await ethers.provider.getBlock()
    const events = await tornadoNFT.queryFilter(filter, fromBlock.number)
    const bobReceiveUtxo = Utxo.decrypt(bobKeypair, events[0].args.encryptedOutput, events[0].args.index)
    expect(bobReceiveUtxo.tokenId).to.be.equal(bobReceiveUtxo.tokenId)

    // Bob withdraws a NFT from the shielded pool
    await transaction({
      tornadoNFT,
      input: bobReceiveUtxo,
      recipient: bob.address,
    })

    expect(await erc721.ownerOf(tokenId)).to.be.equal(bob.address)
  })
})
