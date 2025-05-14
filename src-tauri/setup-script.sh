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
    
    # Extract version numbers from the output
    version=$(echo "$command_output" | grep -oE '[0-9]+\.[0-9]+' | head -1)
    if [ -z "$version" ]; then
        failed "ubuntu" "Could not extract Ubuntu version from: $command_output"
    fi
    
    # Split version into major and minor
    major_version=$(echo "$version" | cut -d. -f1)
    minor_version=$(echo "$version" | cut -d. -f2)
    
    # Compare versions semantically
    if [ "$major_version" -lt 24 ] || ([ "$major_version" -eq 24 ] && [ "$minor_version" -lt 10 ]); then
        failed "ubuntu" "Ubuntu version $version is less than required version 24.10"
    fi

    finished "ubuntu"
fi

########################################################################################
if ! (already_ran "system"); then
    started "system"

    echo "-----------------------------------------------------------------"
    echo "CHECKING SYSTEM"

    run_command "git --version"
    command_output=$(fetch_output 1)

    run_command "./scripts/get_shasum.sh ~/commander-deploy"
    shasum_output=$(fetch_output | tail -n1)
    
    # Extract version numbers from the output - handle both 2 and 3 number versions
    version=$(echo "$command_output" | grep -oE '[0-9]+(\.[0-9]+){1,2}' | head -1)

    if [ -z "$shasum_output" ]; then
        failed "system" "get_shasum command failed"
    if [ -z "$version" ]; then
        failed "git" "Could not extract Git version from: $command_output"
    fi
    
    # Get major and minor versions
    echo "SHASUM: $shasum_output"
    major_version=$(echo "$version" | cut -d. -f1)
    run_command "cat SHASUMS256"
    shasum256_output=$(fetch_output)
    minor_version=$(echo "$version" | cut -d. -f2)
    

    if [ -z "$shasum256_output" ]; then
        failed "system" "SHASUMS256 not found"
    # Compare versions semantically
    if [ "$major_version" -lt 2 ] || ([ "$major_version" -eq 2 ] && [ "$minor_version" -lt 45 ]); then
        failed "git" "Git version $version is less than required version 2.45"
    fi

    run_command "git clone https://github.com/argonprotocol/commander-deploy"
    if ! echo "$shasum256_output" | grep "deploy $shasum_output" > /dev/null; then
        failed "system" "SHASUMS256 does contain: $command_output"
    fi

    finished "system" "$command_output"
    cd commander-deploy
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
    # Extract version numbers from the output - handle both 2 and 3 number versions
    version=$(echo "$command_output" | grep -oE '[0-9]+(\.[0-9]+){1,2}' | head -1)
    if [ -z "$version" ]; then
        failed "docker" "Could not extract Docker version from: $command_output"
    fi
    
    # Get major version
    major_version=$(echo "$version" | cut -d. -f1)
    
    # Compare major version
    if [ "$major_version" -lt 27 ]; then
        failed "docker" "Docker version $version is less than required major version 28"
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

    finished "bitcoinsync"
fi

########################################################################################
if ! (already_ran "bitcoindata"); then
    started "bitcoindata"

    echo "-----------------------------------------------------------------"
    echo "RUNNING BITCOIN-DATA CONTAINER"
#    run_command "docker compose run --remove-orphans --pull=always bitcoin-data"
#    command_output=$(fetch_output)
#    if echo "$command_output" | grep "no configuration file provided: not found" > /dev/null; then
#         failed "bitcoindata" "no configuration file provided: not found"
#    fi

    finished "bitcoindata"
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

    finished "argonsync"
fi

########################################################################################
started "minerlaunch"

echo "-----------------------------------------------------------------"
echo "STARTING MINERS"

run_command "docker compose --env-file=.env.$ARGON_CHAIN up -d"
command_output=$(fetch_output)
if echo "$command_output" | grep "no configuration file provided: not found" > /dev/null; then
    failed "minerlaunch"
fi

finished "minerlaunch"
