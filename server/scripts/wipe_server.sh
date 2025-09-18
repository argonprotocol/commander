#!/bin/bash

pkill -f "$HOME/server/scripts/installer.sh"

cd ~/server

docker compose --profile=all down --rmi all --volumes --remove-orphans
docker system prune -a --volumes

rm -rf ~/server*
rm -rf ~/config
rm -rf ~/logs
rm -rf ~/data

echo "Server wiped clean"
