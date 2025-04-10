#!/bin/bash

akey=""
base_dir=~/setup-logs

# Create log directory if it doesn't exist
mkdir -p "$base_dir"

run_command() {
    command=$1
    echo "% $command" | tee -a "$base_dir/$akey.log"
    # Use eval to properly handle command with arguments
    eval "$command" 2>&1 | tee -a "$base_dir/$akey.log"
    command_exit_status=${PIPESTATUS[0]}
    if [ $command_exit_status -ne 0 ]; then
        failed $akey
    fi
}

fetch_output() {
    cat "$base_dir/$akey.log"
}

started() {
    name=$1
    if [ ! -z "$akey" ]; then
        echo "Error: akey is already set"
        exit 1
    fi
    akey=$name
    filepath="${base_dir}/${name}.started"
    if [ -f "$filepath" ]; then
        echo "Error: $filepath already exists"
        exit 1
    fi
    echo "STARTED" >> "$filepath"
}

finished() {
    name=$1
    if [ "$name" != "$akey" ]; then
        echo "Error: name ($name) does not match current akey ($akey) in finished()"
        exit 1
    fi
    akey=""
    echo "FINISHED" >> "${base_dir}/${name}.finished"
}

failed() {
    name=$1
    error_message=$2
    if [ "$name" != "$akey" ]; then
        echo "Error: name ($name) does not match current akey ($akey) in failed()"
        exit 1
    fi
    echo "$error_message" >> "${base_dir}/${name}.failed"
    exit 1
}

########################################################################################
started "ubuntu"

echo "-----------------------------------------------------------------"
echo "CHECKING UBUNTU VERSION"

run_command "lsb_release -d"
command_output=$(fetch_output)
if ! echo "$command_output" | grep "Ubuntu 22.04" > /dev/null; then
    failed "ubuntu" "ubuntu version is not 22.04: $command_output"
fi

finished "ubuntu"

########################################################################################
started "git"

echo "-----------------------------------------------------------------"
echo "CHECKING GIT VERSION + CLONING REPO"

run_command "git --version"
command_output=$(fetch_output)
if ! echo "$command_output" | grep "version 2.34" > /dev/null; then
    failed "git" "git version is not 2.34: $command_output"
fi

run_command "git clone https://github.com/argonprotocol/argon-commander-deploy"

cd argon-commander-deploy
git checkout syncstatus

finished "git"

########################################################################################
started "docker"

echo "-----------------------------------------------------------------"
echo "CHECKING DOCKER VERSION"

run_command "docker --version"
command_output=$(fetch_output)
if ! echo "$command_output" | grep "version 28" > /dev/null; then
    failed "docker" "docker version is not 28: $command_output"
fi

echo "CHANGING DIRECTORY"
cd argon-commander-deploy
ls

echo "RUNNING BITCOIN-DATA CONTAINER"
run_command "docker compose run --remove-orphans --pull=always bitcoin-data"
command_output=$(fetch_output)
if echo "$command_output" | grep "no configuration file provided: not found" > /dev/null; then
    failed "docker" "no configuration file provided: not found"
fi

echo "BUILDING BITCOIN IMAGE"
run_command "docker compose build bitcoin"
command_output=$(fetch_output)
if echo "$command_output" | grep "no configuration file provided: not found" > /dev/null; then
    failed "docker" "no configuration file provided: not found"
fi

finished "docker"

########################################################################################
started "blocksync"

echo "-----------------------------------------------------------------"
echo "CHANGING DIRECTORY"
cd argon-commander-deploy
ls

echo "STARTING DOCKER COMPOSE"
run_command "docker compose up -d"
command_output=$(fetch_output)
if echo "$command_output" | grep "no configuration file provided: not found" > /dev/null; then
    failed "blocksync"
fi
