#!/bin/bash

if [ ! -d /data ]; then
    echo "Make sure data directory exits already for this to work"
    exit 1
fi

echo "Running cmd: $@"
exec "$@"
