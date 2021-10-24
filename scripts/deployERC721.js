const { ethers } = require('hardhat')

async function main() {
  const [admin] = await ethers.getSigners()
  const NFT = await ethers.getContractFactory('ERC721Mock')
  console.log('Deploying ERC721 contract...')
  const nft = await NFT.deploy()
  console.log('Deploying ERC721 contract...', nft.address)
  await nft.deployed()
  console.log('Deploying ERC721 contract...')
  await nft.mint(admin.address, 1)
  console.log(`deployed: ${nft.address}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
