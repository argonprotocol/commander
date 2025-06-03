#!/bin/bash

# Exit if setup is already running
# if [ -f ~/setup-is-running ]; then
#     echo "Script is already running"
#     exit 1
# fi
# touch ~/setup-is-running
# trap 'rm -f ~/setup-is-running' EXIT

logs_dir=~/install-logs

# Source the helpers file
source "$(dirname "$0")/helpers.sh"

########################################################################################
if ! (already_ran "UbuntuCheck"); then
    start "UbuntuCheck"

    echo "-----------------------------------------------------------------"
    echo "CHECKING UBUNTU VERSION"

    command_output=$(run_command "lsb_release -d")
    
    # Extract version numbers from the output
    version=$(echo "$command_output" | grep -oE '[0-9]+\.[0-9]+' | head -1)
    if [ -z "$version" ]; then
        failed "Could not extract Ubuntu version from: $command_output"
    fi
    
    # Split version into major and minor
    major_version=$(echo "$version" | cut -d. -f1)
    minor_version=$(echo "$version" | cut -d. -f2)
    
    # Compare versions semantically
    if [ "$major_version" -lt 24 ] || ([ "$major_version" -eq 24 ] && [ "$minor_version" -lt 10 ]); then
        failed "Ubuntu version $version is less than required version 24.10"
    fi

    finish "UbuntuCheck"
fi

########################################################################################
reset "FileCheck"
start "FileCheck"

echo "-----------------------------------------------------------------"
echo "CHECKING COREFILES"

check_shasum "deploy"
check_shasum "bot"
check_shasum "calculator"
check_shasum "scripts"
run_command "cp ~/SHASUMS256 ~/SHASUMS256.validated"

finish "FileCheck"

########################################################################################

cd deploy

########################################################################################
if ! (already_ran "DockerInstall"); then
    start "DockerInstall"

    echo "-----------------------------------------------------------------"
    echo "INSTALLING DOCKER"

    sleep 2
    run_command "sudo apt update"

    run_command "sudo apt install -y \
        ca-certificates \
        curl \
        gnupg \
        lsb-release"


    run_command "sudo mkdir -p /etc/apt/keyrings"
    run_command "curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
        sudo gpg --yes --dearmor -o /etc/apt/keyrings/docker.gpg"

    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" | \
        sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    run_command "sudo apt update"
    run_command "sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin"

    run_command "sudo systemctl status docker"
    command_output=$(run_command "docker --version")

    # Extract version numbers from the output - handle both 2 and 3 number versions
    version=$(echo "$command_output" | grep -oE '[0-9]+(\.[0-9]+){1,2}' | head -1)
    if [ -z "$version" ]; then
        failed "Could not extract Docker version from: $command_output"
    fi
    
    # Get major version
    major_version=$(echo "$version" | cut -d. -f1)
    
    # Compare major version
    if [ "$major_version" -lt 27 ]; then
        failed "Docker version $version is less than required major version 28"
    fi

    finish "DockerInstall" "$command_output"
fi

########################################################################################
if ! (already_ran "BitcoinInstall"); then
    start "BitcoinInstall"

    echo "-----------------------------------------------------------------"
    echo "BUILDING BITCOIN IMAGE"

    command_output=$(run_command "docker compose build bitcoin")
    if echo "$command_output" | grep "no configuration file provided: not found" > /dev/null; then
        failed "no configuration file provided: not found"
    fi
    
    command_output=$(run_command "docker images")
    if ! echo "$command_output" | grep -q "bitcoin"; then
        failed "bitcoin image was not found"
    fi

    finish "BitcoinInstall"
fi

########################################################################################
if ! (already_ran "BitcoinData"); then
    start "BitcoinData"

    echo "-----------------------------------------------------------------"
    echo "RUNNING BITCOIN-DATA CONTAINER"
#    command_output=$(run_command "docker compose run --remove-orphans --pull=always bitcoin-data")
#    if echo "$command_output" | grep "no configuration file provided: not found" > /dev/null; then
#         failed "no configuration file provided: not found"
#    fi

    finish "BitcoinData"
fi

########################################################################################
if ! (already_ran "ArgonInstall"); then
    start "ArgonInstall"

    echo "-----------------------------------------------------------------"
    echo "BUILDING ARGON-MINER IMAGE"

    command_output=$(run_command "docker compose build argon-miner")
    if echo "$command_output" | grep "no configuration file provided: not found" > /dev/null; then
        failed "no configuration file provided: not found"
    fi

    command_output=$(run_command "docker images")
    if ! echo "$command_output" | grep -q "argon-miner"; then
        failed "argon-miner image was not found"
    fi

    run_command "docker compose build bot"
    command_output=$(run_command "docker images")
    if ! echo "$command_output" | grep -q "bot"; then
        failed "bot image was not found:\n$command_output"
    fi    

    finish "ArgonInstall"
fi

########################################################################################
reset "DockerLaunch"
start "DockerLaunch"

echo "-----------------------------------------------------------------"
echo "STARTING MINERS"

command_output=$(run_command "docker compose --env-file=.env.$ARGON_CHAIN --profile miners up -d --build --force-recreate")
if echo "$command_output" | grep "no configuration file provided: not found" > /dev/null; then
    failed "no configuration file provided: not found"
fi

sleep 2
run_command "docker compose --env-file=.env.$ARGON_CHAIN up bot -d --build --force-recreate"

finish "DockerLaunch"
