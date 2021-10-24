#!/bin/bash -e
POWERS_OF_TAU=15 # circuit will support max 2^POWERS_OF_TAU constraints
mkdir -p artifacts/circuits
if [ ! -f artifacts/circuits/ptau$POWERS_OF_TAU ]; then
  echo "Generating powers of tau file"
  npx snarkjs powersoftau new bn128 $POWERS_OF_TAU artifacts/circuits/tmp_ptau$POWERS_OF_TAU
  npx snarkjs powersoftau contribute artifacts/circuits/tmp_ptau$POWERS_OF_TAU artifacts/circuits/tmp2_ptau$POWERS_OF_TAU
  npx snarkjs powersoftau prepare phase2 artifacts/circuits/tmp2_ptau$POWERS_OF_TAU artifacts/circuits/ptau$POWERS_OF_TAU
  rm artifacts/circuits/tmp_ptau$POWERS_OF_TAU artifacts/circuits/tmp2_ptau$POWERS_OF_TAU
fi
npx circom -v -r artifacts/circuits/$1.r1cs -w artifacts/circuits/$1.wasm -s artifacts/circuits/$1.sym circuits/$1.circom
npx snarkjs groth16 setup artifacts/circuits/$1.r1cs artifacts/circuits/ptau$POWERS_OF_TAU artifacts/circuits/tmp_$1.zkey
echo "qwe" | npx snarkjs zkey contribute artifacts/circuits/tmp_$1.zkey artifacts/circuits/$1.zkey
npx snarkjs zkey export solidityverifier artifacts/circuits/$1.zkey artifacts/circuits/$1Verifier.sol
# sed -i.bak "s/contract Verifier/contract Verifier${1}/g" artifacts/circuits/$1Verifier.sol
npx snarkjs info -r artifacts/circuits/$1.r1cs
