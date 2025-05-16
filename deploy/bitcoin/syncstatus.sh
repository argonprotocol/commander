#!/bin/bash

localhost_block_number=$(bitcoin-cli --conf="$BITCOIN_CONFIG" getblockchaininfo | jq -r '.blocks')
localhost_synced=true #$(bitcoin-cli --conf="$BITCOIN_CONFIG" getindexinfo | jq -r '.synced')

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

# Calculate sync percentage (capped at 100%)
sync_pct=$(awk -v local="$localhost_block_number" -v main="$mainchain_block_number" 'BEGIN { pct = (local / main) * 100; print (pct > 99 ? 99 : (pct < 0 ? 0 : pct)) }' | xargs printf "%.2f")

if [ "$localhost_synced" = "true" ]; then
  sync_pct=$(awk -v n="$sync_pct" 'BEGIN { printf "%.2f", n + 1 }')
fi

echo "$sync_pct%"
