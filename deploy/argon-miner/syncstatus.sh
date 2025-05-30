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
localhost_block_number=$(echo "$block_numbers" | cut -d'-' -f1)
mainchain_block_number=$(echo "$block_numbers" | cut -d'-' -f2)

# Calculate sync percentage (capped at 100%)
sync_pct=$(awk -v local="$localhost_block_number" -v main="$mainchain_block_number" 'BEGIN { pct = (local / main) * 100; print (pct > 100 ? 100 : pct) }' | xargs printf "%.2f")

# Save output to file and display it
echo "$sync_pct%"
