include "../node_modules/circomlib/circuits/compconstant.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";
include "./merkleProof.circom"
include "./merkleTreeUpdater.circom"
include "./utils.circom"

/*
Utxo structure:
{
    tokenHash, // keccak256(tokenAddress, tokenId)
    pubkey,
    blinding, // random number
}

commitment = hash(tokenHash, pubKey, blinding)
nullifier = hash(commitment, privKey, merklePath)
*/

template Transaction(levels, zeroLeaf) {
    signal input root;
    signal input newRoot;
    signal input publicTokenHash;
    signal input extDataHash;

    // data for transaction inputs
    signal         input inputNullifier;
    signal private input inTokenHash;
    signal private input inPrivateKey;
    signal private input inBlinding;
    signal private input inPathIndices;
    signal private input inPathElements[levels];

    // data for transaction outputs
    signal         input outputCommitment;
    signal private input outTokenHash;
    signal private input outPubkey;
    signal private input outBlinding;
    signal         input outPathIndices;
    signal private input outPathElements[levels];

    component inKeypair;
    component inUtxoHasher;
    component inNullifierHasher;
    component inMerkleProof;

    // compute public key from private key
    inKeypair = Keypair();
    inKeypair.privateKey <== inPrivateKey;

    // compute input commitment
    inUtxoHasher = Poseidon(3);
    inUtxoHasher.inputs[0] <== inTokenHash;
    inUtxoHasher.inputs[1] <== inKeypair.publicKey;
    inUtxoHasher.inputs[2] <== inBlinding;

    // compute input nullifier
    inNullifierHasher = Poseidon(3);
    inNullifierHasher.inputs[0] <== inUtxoHasher.out;
    inNullifierHasher.inputs[1] <== inPathIndices;
    inNullifierHasher.inputs[2] <== inPrivateKey;

    // check input merkle proof
    inMerkleProof = MerkleProof(levels);
    inMerkleProof.leaf <== inUtxoHasher.out;
    inMerkleProof.pathIndices <== inPathIndices;
    for (var i = 0; i < levels; i++) {
        inMerkleProof.pathElements[i] <== inPathElements[i];
    }

    component outUtxoHasher;
    outUtxoHasher = Poseidon(3);
    outUtxoHasher.inputs[0] <== outTokenHash;
    outUtxoHasher.inputs[1] <== outPubkey;
    outUtxoHasher.inputs[2] <== outBlinding;

    // ----- checks that depend on transaction type -----
    // when inTokenHash is zero, don't check input merkle root and input nullifier; set input nullifier to zero
    component inCheckRoot;
    inCheckRoot = ForceEqualIfEnabled();
    inCheckRoot.in[0] <== inMerkleProof.root;
    inCheckRoot.in[1] <== root;
    inCheckRoot.enabled <== inTokenHash;

    component inCheckNullifier;
    inCheckNullifier = ForceEqualIfEnabled();
    inCheckNullifier.in[0] <== inNullifierHasher.out;
    inCheckNullifier.in[1] <== inputNullifier;
    inCheckNullifier.enabled <== inTokenHash;

    /*
        todo: inTokenHash == 0 && inputNullifier == 0 || inTokenHash != 0 && inputNullifier == inNullifierHasher.out
        inTokenHash * (inputNullifier - inNullifierHasher.out)
    */

    // when outTokenHash is zero, don't check output commitment and set it to zero
    component outCheckCommitment;
    outCheckCommitment = ForceEqualIfEnabled();
    outCheckCommitment.in[0] <== outUtxoHasher.out;
    outCheckCommitment.in[1] <== outputCommitment;
    outCheckCommitment.enabled <== outTokenHash;

    // todo one of inTokenHash, outTokenHash, publicTokenHash must be zero, and two others must be equal
    //inTokenHash * outTokenHash * publicTokenHash === 0;
    //(inTokenHash - outTokenHash) * (inTokenHash - publicTokenHash) * (outTokenHash - publicTokenHash) === 0;

    // ----- merkle tree update -----
    // Check merkle tree update with inserted transaction output
    component treeUpdater = TreeUpdater(levels, 0, zeroLeaf);
    treeUpdater.oldRoot <== root;
    treeUpdater.newRoot <== newRoot;
    treeUpdater.leaves[0] <== outputCommitment;
    treeUpdater.pathIndices <== outPathIndices;
    for (var i = 0; i < levels; i++) {
        treeUpdater.pathElements[i] <== outPathElements[i];
    }
}

component main = Transaction(5, 21663839004416932945382355908790599225266501822907911457504978515578255421292);
