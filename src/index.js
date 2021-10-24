/* eslint-disable no-console */
const MerkleTree = require('fixed-merkle-tree')
const { toFixedHex, poseidonHash2, getExtDataHash, getTokenHash } = require('./utils')
const Utxo = require('./utxo')

const { prove } = require('./prover')
const MERKLE_TREE_HEIGHT = 5

async function buildMerkleTree({ tornadoNFT }) {
  const filter = tornadoNFT.filters.NewCommitment()
  const events = await tornadoNFT.queryFilter(filter, 0)

  const leaves = events.sort((a, b) => a.args.index - b.args.index).map((e) => toFixedHex(e.args.commitment))
  return new MerkleTree(MERKLE_TREE_HEIGHT, leaves, { hashFunction: poseidonHash2 })
}

async function getProof({ input, output, tree, recipient, tornadoNFT }) {
  input = input || new Utxo()
  output = output || new Utxo()
  tree = tree || (await buildMerkleTree({ tornadoNFT }))
  recipient = recipient || 0

  let inputMerklePathIndices = 0
  let inputMerklePathElements = new Array(tree.levels).fill(0)

  if (!input.tokenAddress.eq(0)) {
    const index = tree.indexOf(toFixedHex(input.getCommitment()))
    if (index < 0) {
      throw new Error(`Input commitment ${toFixedHex(input.getCommitment())} was not found`)
    }
    inputMerklePathIndices = index
    inputMerklePathElements = tree.path(index).pathElements
  }

  const oldRoot = tree.root()
  output.index = tree.elements().length
  tree.insert(output.getCommitment())
  const outputIndex = tree.elements().length - 1
  const outputPath = tree.path(outputIndex).pathElements

  const extData = {
    tokenAddress: toFixedHex(input.tokenAddress.eq(0) ? output.tokenAddress : input.tokenAddress, 20),
    tokenId: toFixedHex(input.tokenId.eq(0) ? output.tokenId : input.tokenId),
    recipient: toFixedHex(recipient, 20),
    encryptedOutput: output.encrypt(),

    // data used for private token sell
    swapToken: toFixedHex(0, 20),
    swapAmount: toFixedHex(0),
    swapSender: toFixedHex(0, 20),
    swapRecipient: toFixedHex(0, 20),
  }

  const publicTokenHash =
    !input.tokenAddress.eq(0) && !output.tokenAddress.eq(0)
      ? 0
      : getTokenHash(extData.tokenAddress, extData.tokenId)
  const extDataHash = getExtDataHash(extData)
  let snarkInput = {
    root: oldRoot,
    newRoot: tree.root(),
    publicTokenHash,
    inputNullifier: input.getNullifier(),
    outputCommitment: output.getCommitment(),
    extDataHash,

    // data for transaction input
    inTokenHash: input.getTokenHash(),
    inPrivateKey: input.keypair.privkey,
    inBlinding: input.blinding,
    inPathIndices: inputMerklePathIndices,
    inPathElements: inputMerklePathElements,

    // data for transaction output
    outTokenHash: output.getTokenHash(),
    outBlinding: output.blinding,
    outPubkey: output.keypair.pubkey,
    outPathIndices: outputIndex,
    outPathElements: outputPath,
  }

  const proof = await prove(snarkInput, './artifacts/circuits/transaction')

  const args = {
    proof,
    root: toFixedHex(snarkInput.root),
    newRoot: toFixedHex(snarkInput.newRoot),
    tokenHash: toFixedHex(snarkInput.publicTokenHash),
    extDataHash: toFixedHex(snarkInput.extDataHash),
    inputNullifier: toFixedHex(snarkInput.inputNullifier),
    outputCommitment: toFixedHex(snarkInput.outputCommitment),
    outPathIndices: toFixedHex(snarkInput.outPathIndices),
  }

  return {
    extData,
    args,
  }
}

async function transaction({ tornadoNFT, ...rest }) {
  const { args, extData } = await getProof({
    tornadoNFT,
    ...rest,
  })

  const receipt = await tornadoNFT.transaction(args, extData, {
    gasLimit: 1e6,
  })
  await receipt.wait()
}

module.exports = { transaction }
