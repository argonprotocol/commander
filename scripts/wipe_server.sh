#!/bin/bash

pkill -f "$HOME/scripts/installer.sh"

cd ~/deploy

docker compose --env-file=.env.testnet --profile=all down
docker rmi -f $(docker images -aq)

cd ~/

rm -rf ~/*

echo "Server wiped clean"