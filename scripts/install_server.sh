#!/bin/bash

# Debug logging - use absolute path to ensure we catch all instances
DEBUG_LOG="/tmp/install_server_debug.log"
SCRIPT_PATH="$(readlink -f "$0")"

# Prevent recursive execution
if [ "$PPID" != "1" ]; then
    echo "Error: This script should not be run as a child process. Please run it directly."
    exit 1
fi

# Debug logging
{
    echo "----------------------------------------"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Script started with PID $$"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Script path: $SCRIPT_PATH"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Command line: $0 $*"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Current directory: $(pwd)"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] User: $(whoami)"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Parent process: $(ps -o comm= -p $PPID)"
} >> "$DEBUG_LOG"

# Lock file path - use absolute path
LOCKFILE="/tmp/install_server.lock"

# Function to clean up lock file on exit
cleanup() {
    {
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaning up lock file for PID $$"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Script path: $SCRIPT_PATH"
    } >> "$DEBUG_LOG"
    rm -f "$LOCKFILE"
    exit
}

# Set up trap to clean up lock file on script exit
trap cleanup EXIT INT TERM

# Try to acquire lock
if ! (set -o noclobber; echo "$$" > "$LOCKFILE") 2>/dev/null; then
    # If we couldn't acquire the lock, check if the process is still running
    if [ -f "$LOCKFILE" ]; then
        pid=$(cat "$LOCKFILE")
        {
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Found existing lock file with PID $pid"
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Script path: $SCRIPT_PATH"
        } >> "$DEBUG_LOG"
        
        if ps -p "$pid" > /dev/null 2>&1; then
            {
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] Process $pid is still running"
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] Process command: $(ps -p $pid -o command=)"
            } >> "$DEBUG_LOG"
            echo "Error: Another instance of the script is already running (PID: $pid)"
            exit 1
        else
            # Process is not running, remove stale lock file
            {
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] Process $pid is not running, removing stale lock"
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] Script path: $SCRIPT_PATH"
            } >> "$DEBUG_LOG"
            rm -f "$LOCKFILE"
            # Try to acquire lock again
            if ! (set -o noclobber; echo "$$" > "$LOCKFILE") 2>/dev/null; then
                {
                    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Failed to acquire lock after removing stale lock"
                    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Script path: $SCRIPT_PATH"
                } >> "$DEBUG_LOG"
                echo "Error: Failed to acquire lock after removing stale lock file"
                exit 1
            fi
        fi
    else
        {
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Failed to acquire lock"
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Script path: $SCRIPT_PATH"
        } >> "$DEBUG_LOG"
        echo "Error: Failed to acquire lock"
        exit 1
    fi
fi

{
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Successfully acquired lock"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Script path: $SCRIPT_PATH"
} >> "$DEBUG_LOG"

logs_dir=~/install-logs

# Source the helpers file
source "$(dirname "$0")/helpers.sh"

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
if ! (already_ran "UbuntuCheck"); then
    start "UbuntuCheck"

    echo "-----------------------------------------------------------------"
    echo "CHECKING UBUNTU VERSION"

    command_output=$(run_command "cat /etc/os-release")
    
    # Extract VERSION_ID from the output
    version=$(echo "$command_output" | grep "^VERSION_ID=" | cut -d'"' -f2)
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
    echo "BUILDING BITCOIN FOR $ARGON_CHAIN"

    command_output=$(run_command "docker compose --env-file=.env.$ARGON_CHAIN build bitcoin")
    if echo "$command_output" | grep "no configuration file provided: not found" > /dev/null; then
        failed "no configuration file provided: not found"
    fi
    
    command_output=$(run_command "docker images")
    if ! echo "$command_output" | grep -q "bitcoin"; then
        failed "bitcoin image was not found"
    fi

    # echo "-----------------------------------------------------------------"
    # echo "RUNNING BITCOIN-DATA CONTAINER"
#    command_output=$(run_command "docker compose --env-file=.env.$ARGON_CHAIN run --remove-orphans --pull=always bitcoin-data")
#    if echo "$command_output" | grep "no configuration file provided: not found" > /dev/null; then
#         failed "no configuration file provided: not found"
#    fi

    finish "BitcoinInstall"
fi

########################################################################################
if ! (already_ran "ArgonInstall"); then
    start "ArgonInstall"

    echo "-----------------------------------------------------------------"
    echo "BUILDING ARGON-MINER FOR $ARGON_CHAIN"

    command_output=$(run_command "docker compose --env-file=.env.$ARGON_CHAIN build argon-miner")
    if echo "$command_output" | grep "no configuration file provided: not found" > /dev/null; then
        failed "no configuration file provided: not found"
    fi

    command_output=$(run_command "docker images")
    if ! echo "$command_output" | grep -q "argon-miner"; then
        failed "argon-miner image was not found"
    fi

    run_command "docker compose --env-file=.env.$ARGON_CHAIN build bot"
    command_output=$(run_command "docker images")
    if ! echo "$command_output" | grep -q "bot"; then
        failed "bot image was not found:\n$command_output"
    fi    

    finish "ArgonInstall"
fi

########################################################################################
reset "MiningLaunch"
start "MiningLaunch"

echo "-----------------------------------------------------------------"
echo "STARTING MINERS ON $ARGON_CHAIN"

command_output=$(run_command "docker compose --env-file=.env.$ARGON_CHAIN --profile miners up -d --build --force-recreate")
if echo "$command_output" | grep "no configuration file provided: not found" > /dev/null; then
    failed "no configuration file provided: not found"
fi

sleep 2
run_command "docker compose --env-file=.env.$ARGON_CHAIN up bot -d --build --force-recreate"

finish "MiningLaunch"

