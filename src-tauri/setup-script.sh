#!/bin/bash

akey=""
base_dir=~/setup-logs

run_command() {
    command=$1
    echo "% $command"
    touch "$base_dir/$akey.log"
    script -q /dev/null -c "$command 2>&1" | tee -a "$base_dir/$akey.log"
    command_exit_status=${PIPESTATUS[0]}
    if [ $command_exit_status -ne 0 ]; then
        failed
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
        echo "Error: name ($name) does not match current akey ($akey)"
        exit 1
    fi
    akey=""
    echo "FINISHED" >> "${base_dir}/${name}.finished"
}

failed() {
    name=$1
        if [ "$name" != "$akey" ]; then
        echo "Error: name ($name) does not match current akey ($akey)"
        exit 1
    fi
    echo "FAILED" >> "${base_dir}/${name}.failed"
    exit 1
}

########################################################################################
started "ubuntu"

echo "-----------------------------------------------------------------"
echo "CHECKING UBUNTU VERSION"

run_command "lsb_release -d"
command_output=$(fetch_output)
if ! echo "$command_output" | grep "Ubuntu 22.04" > /dev/null; then
    failed "ubuntu"
fi

finished "ubuntu"

########################################################################################
started "git"

echo "-----------------------------------------------------------------"
echo "CHECKING GIT VERSION + CLONING REPO"

run_command "git --version"
command_output=$(fetch_output)
if ! echo "$command_output" | grep "version 2.34" > /dev/null; then
    failed "git"
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
    failed "docker"
fi

echo "CHANGING DIRECTORY"
cd argon-commander-deploy
ls

echo "RUNNING BITCOIN-DATA CONTAINER"
run_command "docker compose run --remove-orphans --pull=always bitcoin-data"
command_output=$(fetch_output)
if echo "$command_output" | grep "no configuration file provided: not found" > /dev/null; then
    failed "docker"
fi

echo "BUILDING BITCOIN IMAGE"
run_command "docker compose build bitcoin"
command_output=$(fetch_output)
if echo "$command_output" | grep "no configuration file provided: not found" > /dev/null; then
    failed "docker"
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
