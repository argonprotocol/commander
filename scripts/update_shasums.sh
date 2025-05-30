#!/bin/bash

# get the parent directory of the script
BASE_DIR=$(dirname "$0")/..
TARGET_DIRS=(
  "deploy"
  "bot"
  "calculator"
  "scripts"
);
SCRIPT_DIR=$(dirname "$0")
OUTPUT_NAME="${1:-SHASUMS256}"

SHASUMS=""
# make an entry for each of the target directories
for dir in "${TARGET_DIRS[@]}"; do
  TARGET_DIR=$(cd "$BASE_DIR/$dir" && pwd)
  # get the sha256sum of the target directory
  SHASUM=$($SCRIPT_DIR/create_shasum.sh $TARGET_DIR)
  echo "SHASUMS256 of $dir is $SHASUM"
  # add a newline if SHASUMS is not empty
  if [ -n "$SHASUMS" ]; then
    SHASUMS+="\n"
  fi
  SHASUMS+="$dir $SHASUM"
done

# update the sha256sum file
echo -e $SHASUMS > $BASE_DIR/$OUTPUT_NAME
echo "Updated $OUTPUT_NAME"
