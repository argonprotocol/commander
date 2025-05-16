#!/bin/bash

# Function to get block number from a given URL
get_block_number() {
  local url="${1/wss:/https:}"
  curl -s -H "Content-Type: application/json" \
       -d '{"jsonrpc":"2.0","id":1,"method":"chain_getHeader","params":[]}' \
       "$url" | jq -r '.result.number' | xargs printf "%d\n"
}

# Get block numbers
localhost_block_number=$(get_block_number "http://localhost:9944")
mainchain_block_number=$(get_block_number "$ARGON_ARCHIVE_NODE")

# Check if values were retrieved successfully
if [[ -z "$localhost_block_number" || -z "$mainchain_block_number" ]]; then
  echo "Error: Could not retrieve block numbers"
  exit 1
fi

echo "$localhost_block_number-$mainchain_block_number"
