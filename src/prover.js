const { groth16 } = require('snarkjs')
const { utils } = require('ffjavascript')
const { toFixedHex } = require('./utils')

async function prove(input, keyBasePath) {
  const { proof } = await groth16.fullProve(
    utils.stringifyBigInts(input),
    `${keyBasePath}.wasm`,
    `${keyBasePath}.zkey`,
  )
  return (
    '0x' +
    toFixedHex(proof.pi_a[0]).slice(2) +
    toFixedHex(proof.pi_a[1]).slice(2) +
    toFixedHex(proof.pi_b[0][1]).slice(2) +
    toFixedHex(proof.pi_b[0][0]).slice(2) +
    toFixedHex(proof.pi_b[1][1]).slice(2) +
    toFixedHex(proof.pi_b[1][0]).slice(2) +
    toFixedHex(proof.pi_c[0]).slice(2) +
    toFixedHex(proof.pi_c[1]).slice(2)
  )
}

module.exports = { prove }
