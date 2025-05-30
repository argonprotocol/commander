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
# Get Argon block numbers

get_block_number() {
  local url="${1/wss:/https:}"
  curl -s -H "Content-Type: application/json" \
       -d '{"jsonrpc":"2.0","id":1,"method":"chain_getHeader","params":[]}' \
       "$url" | jq -r '.result.number' | xargs printf "%d\n"
}

localhost_block_number=$(get_block_number "http://localhost:9944")
mainchain_block_number=$(get_block_number "$ARGON_ARCHIVE_NODE")

# Check if values were retrieved successfully
if [[ -z "$localhost_block_number" || -z "$mainchain_block_number" ]]; then
  echo "Error: Could not retrieve block numbers"
  exit 1
fi

output="$localhost_block_number-$mainchain_block_number"

########################################################
# Save output to file and display it

echo "$output" > "$OUTPUT_FILE"
echo "$output"
