#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: $0 <directory>"
  exit 1
fi

find "$1" -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum | awk '{ print $1 }' | sha256sum | awk '{ print $1 }'