ARG VERSION=latest

FROM ghcr.io/argonprotocol/argon-miner:$VERSION

USER root
RUN apt-get update && apt-get install -y \
    curl \
    jq \
    bc \
    && rm -rf /var/lib/apt/lists/*

COPY latestblocks.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/latestblocks.sh

COPY syncstatus.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/syncstatus.sh

COPY iscomplete.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/iscomplete.sh

USER argon
