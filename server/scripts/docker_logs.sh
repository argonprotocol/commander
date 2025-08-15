#!/bin/bash

cd ~/server

docker compose --env-file=.env.testnet --profile=all logs $1 
