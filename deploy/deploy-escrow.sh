#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../contracts"
: "${DEPLOYER_KEY:?set DEPLOYER_KEY to a burner wallet key with a little Sepolia ETH}"
RPC=${RPC_URL:-https://ethereum-sepolia-rpc.publicnode.com}
CFG=$(curl -s https://api.squeekchain.com/v1/economy/state)
NFT=$(echo "$CFG" | python3 -c "import json,sys;print(json.load(sys.stdin)['identities']['genesis'])")
SQK=$(echo "$CFG" | python3 -c "import json,sys;print(json.load(sys.stdin)['identities']['token'])")
MAXL=$(echo "$CFG" | python3 -c "import json,sys;print(json.load(sys.stdin)['nft']['maximumLevel'])")
echo "NFT=$NFT SQK=$SQK MAX_LEVEL=$MAXL"
forge test
SQUEEK_NFT=$NFT SQK_TOKEN=$SQK MAX_LEVEL=$MAXL forge script script/DeploySqueekMatchEscrow.s.sol --rpc-url "$RPC" --private-key "$DEPLOYER_KEY" --broadcast
RUN=broadcast/DeploySqueekMatchEscrow.s.sol/11155111/run-latest.json
ESCROW=$(python3 -c "import json;print(json.load(open('$RUN'))['transactions'][0]['contractAddress'])")
BLOCK=$(python3 -c "import json;print(int(json.load(open('$RUN'))['receipts'][0]['blockNumber'],16))")
echo
echo "ESCROW=$ESCROW"
echo "ESCROW_FROM_BLOCK=$BLOCK"
