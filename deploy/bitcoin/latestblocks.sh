#!/bin/bash

OUTPUT_FILE="latestblocks.out"

# Check if output file exists and is less than 2 seconds old
if [ -f "$OUTPUT_FILE" ]; then
    current_time=$(date +%s)
    # Use find command instead of stat for better portability
    file_time=$(find "$OUTPUT_FILE" -printf '%T@' 2>/dev/null)
    if [ $? -ne 0 ]; then
        echo "Warning: Could not get file modification time for $OUTPUT_FILE" >&2
        file_time=0
    else
        file_time=${file_time%.*}  # Remove decimal part
    fi
    time_diff=$((current_time - file_time))
    
    if [ $time_diff -lt 2 ]; then
        cat "$OUTPUT_FILE"
        exit 0
    fi
fi

########################################################
# Get Bitcoin block numbers

localhost_block_number=$(bitcoin-cli --conf="$BITCOIN_CONFIG" getblockchaininfo | jq -r '.blocks')

if [ "$BITCOIN_CHAIN" = "signet" ]; then
  mainchain_block_number=$(bitcoin-cli --conf="$BITCOIN_CONFIG" getpeerinfo | jq 'map(.startingheight) | max')
else
  mainchain_block_number=$(curl -s -m 10 -H "Content-Type: application/json" "https://blockchain.info/latestblock" | jq -r '.block_index')  
fi

# Check if values were retrieved successfully
if [[ -z "$mainchain_block_number" || -z "$localhost_block_number" ]]; then
  echo "Error: Could not retrieve block numbers"
  exit 1
fi

output="$localhost_block_number-$mainchain_block_number"

########################################################
# Save output to file and display it

echo "$output" > "$OUTPUT_FILE"
echo "$output"
