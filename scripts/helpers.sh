# Validate required variables
if [ -z "$logs_dir" ]; then
    echo "Error: logs_dir variable must be set before sourcing this script"
    return 1
fi

akey=""

# Create logs directory if it doesn't exist
mkdir -p "$logs_dir"

########################################################
# Helper functions
########################################################

run_command() {
    command=$1
    # Log the command being run
    echo "% $command" >> "$logs_dir/$akey.log"
    # Use eval to properly handle command with arguments
    # Create a temporary file to capture output
    temp_file=$(mktemp)
    eval "$command" 2>&1 | tee -a "$logs_dir/$akey.log" > "$temp_file"
    command_exit_status=${PIPESTATUS[0]}
    if [ $command_exit_status -ne 0 ]; then
        rm "$temp_file"
        failed $akey
    fi
    # Return the captured output
    cat "$temp_file"
    rm "$temp_file"
}

log_to_file() {
    echo "$1" | tee -a "$logs_dir/$akey.log"
}

fetch_log_contents() {
    lines=${1:-100}  # Default to 100 if no argument provided
    tail -n $lines "$logs_dir/$akey.log"
}

start() {
    step_name=$1
    if [ ! -z "$akey" ]; then
        echo "Error: akey is already set"
        exit 1
    fi
    akey=$step_name
    filepath="${logs_dir}/${step_name}.started"
    if [ -f "$filepath" ]; then
        echo "Error: $filepath already exists"
        exit 1
    fi
    echo "STARTED" >> "$filepath"
}

reset() {
    step_name=$1
    rm "${logs_dir}/${step_name}.started"
    rm "${logs_dir}/${step_name}.finished"
    rm "${logs_dir}/${step_name}.failed"
    rm "${logs_dir}/${step_name}.log"
}

finish() {
    step_name=$1
    command_output=$2
    if [ "$step_name" != "$akey" ]; then
        echo "Error: step_name ($step_name) does not match current akey ($akey) in finished()"
        exit 1
    fi
    akey=""
    if [ ! -z "$command_output" ]; then
        echo "$command_output" >> "${logs_dir}/${step_name}.finished"
    else
        echo "FINISHED" >> "${logs_dir}/${step_name}.finished"
    fi
}

failed() {
    error_message=$1
    echo "$error_message" >> "${logs_dir}/${akey}.failed"
    exit 1
}

already_ran() {
    step_name=$1
    finished_filepath="${logs_dir}/${step_name}.finished"
    [ -f "$finished_filepath" ]
}

check_shasum() {
    dir_name=$1

    command_output=$(run_command "~/scripts/create_shasum.sh ~/$dir_name")
    local_shasum=$(echo "$command_output" | tail -n1)
    if [ -z "$local_shasum" ]; then
        failed "create_shasum command failed"
    fi

    echo "$dir_name: $local_shasum"
    
    command_output=$(run_command "cat ~/SHASUMS256")
    expected_shasums=$(echo "$command_output")
    if [ -z "$expected_shasums" ]; then
        failed "SHASUMS256 not found"
    fi

    if ! echo "$expected_shasums" | grep "$dir_name $local_shasum" > /dev/null; then
        failed "SHASUMS256 does contain: $dir_name $local_shasum"
    fi
}
