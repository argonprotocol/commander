#!/bin/bash

# This script runs a curl command with the given arguments against the local http server on port 3000. If the
# response is not 200, it will return the error and status code as json. Otherwise, it will return the body as json.

# Usage: ./get_bot_http.sh <curl args>

# Example: ./get_bot_http.sh api/vaults -H "Content-Type: application/json" -d '{"key":"value"}'

set -e
set -o pipefail
CURL_ARGS="$@"
if [ -z "$CURL_ARGS" ]; then
    echo "Usage: $0 <curl args>"
    exit 1
fi

RESPONSE=$(curl -s -w "\n%{http_code}" "https://httpbin.org/$CURL_ARGS" || echo -e "\n000")
STATUS_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

# Check if the server is unavailable
if [ "$STATUS_CODE" == "000" ]; then
    echo "{\"error\":\"Server is unavailable\", \"status_code\": 000}"
    exit 1
fi


if echo "$BODY" | jq . >/dev/null 2>&1; then
    DATA="$BODY"
else
    DATA=$(echo "$BODY" | jq -R .)
fi

echo "{\"status_code\": $STATUS_CODE, \"data\": $DATA}"