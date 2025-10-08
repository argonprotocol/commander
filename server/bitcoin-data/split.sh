#!/bin/bash

set -euo pipefail

env_file="${1:-.env}"

set -a
  source "$(dirname "$0")/../$env_file"
set +a

DIRNAME="$(dirname "$0")"
BITCOIN_DATA_DIR="$DIRNAME/../../data/bitcoin"
OUTDIR="$(cd "$DIRNAME" && mkdir -p splits && cd splits && pwd -P)"

echo "Splitting Bitcoin data from $BITCOIN_DATA_DIR into $OUTDIR ($BITCOIN_TAR_PATHS)"

cd "$BITCOIN_DATA_DIR" || exit 1

pwd

rm -f "$OUTDIR/data.tar."*

# shellcheck disable=SC2086
# No double quote because we want word splitting
tar cvf - ${BITCOIN_TAR_PATHS} | split -b 9500M - "$OUTDIR/data.tar."
