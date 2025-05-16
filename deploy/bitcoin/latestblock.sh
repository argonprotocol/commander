#!/bin/bash

localhost_block_number=$(bitcoin-cli --conf="$BITCOIN_CONFIG" getblockchaininfo | jq -r '.blocks')

if [ "$BITCOIN_CHAIN" = "signet" ]; then
  mainchain_block_number=$(bitcoin-cli --conf="$BITCOIN_CONFIG" getpeerinfo | jq 'map(.startingheight) | max')
else
  # Fetch latest block from blockchain.info
  mainchain_block_number=$(curl -s -m 10 -H "Content-Type: application/json" "https://blockchain.info/latestblock" | jq -r '.block_index')  
fi

# Check if values were retrieved successfully
if [[ -z "$mainchain_block_number" || -z "$localhost_block_number" ]]; then
  echo "Error: Could not retrieve block numbers"
  exit 1
fi

echo "$localhost_block_number-$mainchain_block_number"
