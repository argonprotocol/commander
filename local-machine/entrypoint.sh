#!/bin/sh
set -eu

# Use provided UID/GID from env, or default to 1000
USER_ID=${UID:-1000}
GROUP_ID=${GID:-1000}

# Update commander’s UID/GID if needed
if [ "$(id -u commander)" != "$USER_ID" ]; then
    usermod -u "$USER_ID" commander
fi

if [ "$(id -g commander)" != "$GROUP_ID" ]; then
    if getent group "$GROUP_ID" >/dev/null; then
        # Group already exists -> just move commander into it
        usermod -g "$GROUP_ID" commander
    else
        groupmod -g "$GROUP_ID" commander
    fi
fi

# Fix ownership of any bind mounts
chown -R commander:commander /app 2>/dev/null || true

exec "$@"
