#!/bin/bash

BLOCK_COUNT="$1"

jq -s . < <(
  for i in $(seq 0 $BLOCK_COUNT); do
    h=$(bitcoin-cli --conf="$BITCOIN_CONFIG" getblockhash $(($(bitcoin-cli --conf="$BITCOIN_CONFIG" getblockcount) - i)))
    bitcoin-cli --conf="$BITCOIN_CONFIG" getblock $h 1
  done
)

# Example usage: ./recentblocks.sh 10
# This will display the 10 most recent blocks with their height, hash, and number of
