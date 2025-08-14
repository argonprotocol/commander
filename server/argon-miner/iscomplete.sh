#!/bin/bash

get_runtime_version() {
    curl  -s -H 'Content-Type: application/json' \
      -d '{"jsonrpc":"2.0","id":2,"method":"state_getRuntimeVersion","params":[]}' \
      "http://localhost:9944"
}

raw_output=$(get_runtime_version)
result_data=$(echo $raw_output | jq -r '.result // empty')
error_code=$(echo $raw_output | jq -r '.error.code // empty')

has_result=$([ ! -z "$result_data" ] && echo "true" || echo "false")

if [[ "$has_result" == "true" ]]; then
    echo "true"
elif [[ "$error_code" == "4003" ]]; then
    echo "false"
else
    echo $raw_output
fi
