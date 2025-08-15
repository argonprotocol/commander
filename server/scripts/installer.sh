#!/bin/bash

# Debug logging - use absolute path to ensure we catch all instances
DEBUG_LOG="/tmp/installer_debug.log"

SCRIPT_PATH="$(readlink -f "$0")"
SCRIPTS_DIR="$(dirname "$SCRIPT_PATH")"

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
LOCKFILE="/tmp/installer.lock"

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

logs_dir=~/logs

# Source the helpers file
source "$(dirname "$0")/helpers.sh"

########################################################################################
reset "FileUpload"
start "FileUpload"


finish "FileUpload"

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

    echo "-----------------------------------------------------------------"
    echo "SETTING UP UFW FIREWALL RULES"

    command_output=$(run_command "sudo ufw app list | grep -q '^OpenSSH$' && echo 'OpenSSH found' || echo 'OpenSSH not found'")
    if echo "$command_output" | grep -q 'OpenSSH found'; then
        echo "OpenSSH is already installed, allowing OpenSSH through UFW"
        run_command "sudo ufw allow OpenSSH"
    else
        run_command "sudo ufw allow 22/tcp"
    fi
    run_command "sudo ufw --force enable"

    finish "UbuntuCheck"
fi

########################################################################################

cd server

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

    command_output=$(run_command "cat .env.$ARGON_CHAIN | grep -E '^BITCOIN_P2P_PORT=' | cut -d'=' -f2")
    if [ -z "$command_output" ]; then
        failed "BITCOIN_P2P_PORT not found in .env.$ARGON_CHAIN"
    fi
    run_command "ufw allow $command_output/tcp"


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

    command_output=$(run_command "docker compose --env-file=.env.$ARGON_CHAIN up bitcoin -d --build --force-recreate")
    if echo "$command_output" | grep "no configuration file provided: not found" > /dev/null; then
        failed "no configuration file provided: not found"
    fi

    # Loop until syncstatus is >= 100%
    while true; do
        sleep 1
        command_output=$(run_command "docker exec server-bitcoin-1 syncstatus.sh")
        percent_value=$(echo "$command_output" | tr -d '%')
        if (( $(echo "$percent_value >= 100" | bc -l) )); then
            echo "Bitcoin Sync is complete (>= 100%)"
            break
        else
            echo "Bitcoin Sync is not complete (< 100%), waiting... ($percent_value%)"
        fi
    done

    finish "BitcoinInstall"
fi

########################################################################################
if ! (already_ran "ArgonInstall"); then
    start "ArgonInstall"

    echo "-----------------------------------------------------------------"
    echo "BUILDING ARGON-MINER FOR $ARGON_CHAIN"

    run_command "ufw allow 30333/tcp"

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

    command_output=$(run_command "docker compose --env-file=.env.$ARGON_CHAIN up argon-miner -d --build --force-recreate")
    if echo "$command_output" | grep "no configuration file provided: not found" > /dev/null; then
        failed "no configuration file provided: not found"
    fi

    # Loop until syncstatus is >= 100%
    while true; do
        sleep 1
        command_output=$(run_command "docker exec server-argon-miner-1 syncstatus.sh")
        percent_value=$(echo "$command_output" | tr -d '%')
        echo "Argon Sync... ($percent_value%)"
        if (( $(echo "$percent_value >= 100" | bc -l) )); then
            echo "Argon Sync is complete (>= 100%)"
            break
        fi
        command_output=$(run_command "docker exec server-argon-miner-1 iscomplete.sh")
        if [[ "$command_output" != "true" && "$command_output" != "false" && "$command_output" != "" ]]; then
            failed "Argon iscomplete.sh has error: $command_output"
        elif [[ "$command_output" == "" ]]; then
            echo "Argon iscomplete.sh is empty: $command_output"
        fi
    done

    finish "ArgonInstall"
fi

########################################################################################
reset "MiningLaunch"
start "MiningLaunch"

echo "-----------------------------------------------------------------"
echo "STARTING BOT ON $ARGON_CHAIN"

run_command "docker compose --env-file=.env.$ARGON_CHAIN up bot -d --build --force-recreate"


while true; do
    sleep 1
    RESPONSE=$(curl -s -w "\n%{http_code}" "http://127.0.0.1:3000/state" || echo -e "\n000")
    echo "$RESPONSE"
    status=$(echo "$RESPONSE" | tail -n 1)
    if [[ "$status" == "200" ]]; then
        echo "Bot is running"
      break;
    fi
done

finish "MiningLaunch"

# Do NOT finish this step, it will be finished by the installer check
