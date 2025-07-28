#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: $0 <directory>"
  exit 1
fi

find "$1" -type f -not -path "*/node_modules/*" -not -path "*/__test__/*" -not -name "vitest.config.ts" -print0 | LC_ALL=C sort -z | xargs -0 sha256sum | awk '{ print $1 }' | sha256sum | awk '{ print $1 }'