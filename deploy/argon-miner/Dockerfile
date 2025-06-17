ARG VERSION=latest

FROM ghcr.io/argonprotocol/argon-miner:$VERSION

USER root
RUN apt-get update && apt-get install -y \
    curl \
    jq \
    && rm -rf /var/lib/apt/lists/*

COPY syncstatus.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/syncstatus.sh

COPY latestblocks.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/latestblocks.sh

USER argon
