#!/bin/bash

# get the parent directory of the script
BASEDIR=$(dirname "$0")/..
TARGET_DIRS=(
  "deploy"
  "bot"
  "bidding-calculator"
);
SCRIPTDIR=$(dirname "$0")


SHASUMS=""
# make an entry for each of the target directories
for dir in "${TARGET_DIRS[@]}"; do
  TARGET_DIR=$(cd "$BASEDIR/$dir" && pwd)
  # get the sha256sum of the target directory
  SHASUM=$($SCRIPTDIR/get_shasum.sh $TARGET_DIR)
  echo "SHASUMS256 of $dir is $SHASUM"
  # add a newline if SHASUMS is not empty
  if [ -n "$SHASUMS" ]; then
    SHASUMS+="\n"
  fi
  SHASUMS+="$dir $SHASUM"
done

# update the sha256sum file
echo -e $SHASUMS > $BASEDIR/SHASUMS256
echo "Updated SHASUMS256"
