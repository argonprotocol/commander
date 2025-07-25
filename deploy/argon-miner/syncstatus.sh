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

# Calculate sync percentage (capped at 100%)
sync_pct=$(awk -v local="$local_node_block_number" -v main="$main_node_block_number" 'BEGIN { pct = (local / main) * 100; print (pct > 100 ? 100 : pct) }' | xargs printf "%.2f")

# Scale down to 99% so we can check if the node is complete
sync_pct=$(awk -v pct="$sync_pct" 'BEGIN { scaled = pct * 0.99; print (scaled > 99 ? 99 : scaled) }' | xargs printf "%.2f")

# If sync is at 99%, check if the node is complete
if (( $(echo "$sync_pct >= 99" | bc -l) )); then
    is_complete=$("$SCRIPT_DIR/iscomplete.sh")
    if [[ "$is_complete" == "true" ]]; then
        sync_pct=100
    fi
fi

# Save output to file and display it
echo "$sync_pct%"
