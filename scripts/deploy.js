const { ethers } = require('hardhat')
const MerkleTree = require('fixed-merkle-tree')
const { poseidonHash2 } = require('../src/utils')

const MERKLE_TREE_HEIGHT = 5

async function main() {
  const Verifier = await ethers.getContractFactory('Verifier')
  const verifier = await Verifier.deploy()
  await verifier.deployed()
  console.log(`verifier: ${verifier.address}`)

  const tree = new MerkleTree(MERKLE_TREE_HEIGHT, [], { hashFunction: poseidonHash2 })
  const TornadoNFT = await ethers.getContractFactory('TornadoNFT')
  const tornadoNFT = await TornadoNFT.deploy(verifier.address, tree.root())
  await tornadoNFT.deployed()
  console.log(`tree root: ${tree.root()}`)
  console.log(`tornadoNFT: ${tornadoNFT.address}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
