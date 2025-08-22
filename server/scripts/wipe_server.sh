#!/bin/bash

pkill -f "$HOME/server/scripts/installer.sh"

cd ~/server

docker compose --env-file=.env.testnet --profile=all down
docker rmi -f $(docker images -aq)
docker system prune -a --volumes

cd ~/

rm -rf ~/*

echo "Server wiped clean"
