# zkNFT [![Build Status](https://github.com/poma/zk-nft/workflows/build/badge.svg)](https://github.com/poma/zk-nft/actions)

Privacy solution for NFTs

## Test

```bash
yarn
yarn download
yarn build
yarn test
```

## Deploy

```bash
hh run --network goerli scripts/deploy.js
hh verify --network goerli <verifier-addr>
hh verify --network goerli <pool-addr> <verifier-addr> <tree-root>
```

