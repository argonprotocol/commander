#!/bin/bash

# Exit if setup is already running
# if [ -f ~/setup-is-running ]; then
#     echo "Script is already running"
#     exit 1
# fi
# touch ~/setup-is-running
# trap 'rm -f ~/setup-is-running' EXIT

akey=""
logs_dir=~/setup-logs

# Create log directory if it doesn't exist
mkdir -p "$logs_dir"

run_command() {
    command=$1
    echo "% $command" | tee -a "$logs_dir/$akey.log"
    # Use eval to properly handle command with arguments
    eval "$command" 2>&1 | tee -a "$logs_dir/$akey.log"
    command_exit_status=${PIPESTATUS[0]}
    if [ $command_exit_status -ne 0 ]; then
        failed $akey
    fi
}

fetch_output() {
    lines=${1:-100}  # Default to 100 if no argument provided
    tail -n $lines "$logs_dir/$akey.log"
}

started() {
    name=$1
    if [ ! -z "$akey" ]; then
        echo "Error: akey is already set"
        exit 1
    fi
    akey=$name
    filepath="${logs_dir}/${name}.started"
    if [ -f "$filepath" ]; then
        echo "Error: $filepath already exists"
        exit 1
    fi
    echo "STARTED" >> "$filepath"
}

finished() {
    name=$1
    command_output=$2
    if [ "$name" != "$akey" ]; then
        echo "Error: name ($name) does not match current akey ($akey) in finished()"
        exit 1
    fi
    akey=""
    if [ ! -z "$command_output" ]; then
        echo "$command_output" >> "${logs_dir}/${name}.finished"
    else
        echo "FINISHED" >> "${logs_dir}/${name}.finished"
    fi
}

failed() {
    name=$1
    error_message=$2
    if [ "$name" != "$akey" ]; then
        echo "Error: name ($name) does not match current akey ($akey) in failed()"
        exit 1
    fi
    echo "$error_message" >> "${logs_dir}/${name}.failed"
    exit 1
}

already_ran() {
    name=$1
    finished_filepath="${logs_dir}/${name}.finished"
    failed_filepath="${logs_dir}/${name}.failed"
    [ -f "$finished_filepath" ] || [ -f "$failed_filepath" ]
}

########################################################################################
if ! (already_ran "ubuntu"); then
    started "ubuntu"

    echo "-----------------------------------------------------------------"
    echo "CHECKING UBUNTU VERSION"

    run_command "lsb_release -d"
    command_output=$(fetch_output)
    if ! echo "$command_output" | grep "Ubuntu 24.10" > /dev/null; then
        failed "ubuntu" "ubuntu version is not 24.10: $command_output"
    fi

    finished "ubuntu"
fi

########################################################################################
if ! (already_ran "git"); then
    started "git"

    echo "-----------------------------------------------------------------"
    echo "CHECKING GIT VERSION + CLONING REPO"

    run_command "git --version"
    command_output=$(fetch_output 1)
    if ! echo "$command_output" | grep "version 2.45.2" > /dev/null; then
        failed "git" "git version is not 2.45.2: $command_output"
    fi

    run_command "git clone https://github.com/argonprotocol/commander-deploy"

    cd commander-deploy
    run_command "git checkout added-bot"

    finished "git" "$command_output"
else
    cd commander-deploy
fi

########################################################################################
if ! (already_ran "docker"); then
    started "docker"

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
    run_command "docker --version"

    command_output=$(fetch_output 1)
    if ! echo "$command_output" | grep "version 28" > /dev/null; then
        failed "docker" "docker version is not 28: $command_output"
    fi

    finished "docker" "$command_output"
fi

########################################################################################
if ! (already_ran "bitcoinsync"); then
    started "bitcoinsync"

    echo "-----------------------------------------------------------------"
    echo "BUILDING BITCOIN IMAGE"

    run_command "docker compose build bitcoin"
    command_output=$(fetch_output)
    if echo "$command_output" | grep "no configuration file provided: not found" > /dev/null; then
        failed "bitcoinsync" "no configuration file provided: not found"
    fi

    # echo "RUNNING BITCOIN-DATA CONTAINER"
    # run_command "docker compose run --remove-orphans --pull=always bitcoin-data"
    # command_output=$(fetch_output)
    # if echo "$command_output" | grep "no configuration file provided: not found" > /dev/null; then
    #     failed "bitcoinsync" "no configuration file provided: not found"
    # fi

    finished "bitcoinsync"
fi

########################################################################################
if ! (already_ran "argonsync"); then
    started "argonsync"

    echo "-----------------------------------------------------------------"
    echo "BUILDING ARGON-MINER IMAGE"

    run_command "docker compose build argon-miner"
    command_output=$(fetch_output)
    if echo "$command_output" | grep "no configuration file provided: not found" > /dev/null; then
        failed "argonsync" "no configuration file provided: not found"
    fi

    # echo "RUNNING ARGON-DATA CONTAINER"
    # run_command "docker compose run --remove-orphans --pull=always argon-data"
    # command_output=$(fetch_output)
    # if echo "$command_output" | grep "no configuration file provided: not found" > /dev/null; then
    #     failed "argonsync" "no configuration file provided: not found"
    # fi

    finished "argonsync"
fi

########################################################################################
started "minerlaunch"

echo "-----------------------------------------------------------------"
echo "STARTING MINERS"

run_command "docker compose --env-file=.env.testnet up -d"
command_output=$(fetch_output)
if echo "$command_output" | grep "no configuration file provided: not found" > /dev/null; then
    failed "minerlaunch"
fi

finished "minerlaunch"