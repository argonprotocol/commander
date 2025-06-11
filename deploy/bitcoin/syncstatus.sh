#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Get block numbers from latestblocks.sh
block_numbers=$("$SCRIPT_DIR/latestblocks.sh")
if [ $? -ne 0 ]; then
  echo "Error: Could not retrieve block numbers"
  exit 1
fi

# Split the output into local and main chain block numbers
local_node_block_number=$(echo "$block_numbers" | cut -d'-' -f1)
main_node_block_number=$(echo "$block_numbers" | cut -d'-' -f2)

localhost_synced=true #$(bitcoin-cli --conf="$BITCOIN_CONFIG" getindexinfo | jq -r '.synced')

# Calculate sync percentage (capped at 99%)
sync_pct=$(awk -v local="$local_node_block_number" -v main="$main_node_block_number" 'BEGIN { pct = (local / main) * 100; print (pct > 99 ? 99 : (pct < 0 ? 0 : pct)) }' | xargs printf "%.2f")

if [ "$localhost_synced" = "true" ] && [ "$sync_pct" = "99.00" ]; then
  sync_pct=$(awk -v n="$sync_pct" 'BEGIN { printf "%.2f", n + 1 }')
fi

# Save output to file and display it
echo "$sync_pct%"
