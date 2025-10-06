# syntax = docker/dockerfile:latest

FROM --platform=linux/amd64 debian AS init-data
ARG TAR_PATHS
ARG REPO_URL
ARG DATA_PATH

RUN --mount=type=bind,source=${DATA_PATH},target=/data,ro \
    --mount=type=cache,target=/cache \
	mkdir -p /cache /init-data && cd /data && \
    tar cvf - ${TAR_PATHS} | split -b 5G - /cache/data.tar. && \
    mv /cache/data.tar.* /init-data/

########################

FROM debian
ARG SNAPSHOT_HEIGHT=unknown
ARG SNAPSHOT_NETWORK=unknown
ARG COMMIT_SHA=none
ARG UTXO_HASH=unknown
LABEL snapshot.height=$SNAPSHOT_HEIGHT
LABEL snapshot.network=$SNAPSHOT_NETWORK
LABEL snapshot.utxohash=$UTXO_HASH
LABEL org.opencontainers.image.revision=$COMMIT_SHA
LABEL org.opencontainers.image.source=https://github.com/argonprotocol/commander
# Make sure we put everything is separate layers so we dont trigger rate limits
# We abuse wildcard here so it doesn't crash if some files don't exist
# Supports 15 split files, i.e. up to 75GB tarball
COPY --link --from=init-data /init-data/data.tar.aa* /init-data/.
COPY --link --from=init-data /init-data/data.tar.ab* /init-data/.
COPY --link --from=init-data /init-data/data.tar.ac* /init-data/.
COPY --link --from=init-data /init-data/data.tar.ad* /init-data/.
COPY --link --from=init-data /init-data/data.tar.ae* /init-data/.
COPY --link --from=init-data /init-data/data.tar.af* /init-data/.
COPY --link --from=init-data /init-data/data.tar.ag* /init-data/.
COPY --link --from=init-data /init-data/data.tar.ah* /init-data/.
COPY --link --from=init-data /init-data/data.tar.ai* /init-data/.
COPY --link --from=init-data /init-data/data.tar.aj* /init-data/.
COPY --link --from=init-data /init-data/data.tar.ak* /init-data/.
COPY --link --from=init-data /init-data/data.tar.al* /init-data/.
COPY --link --from=init-data /init-data/data.tar.am* /init-data/.
COPY --link --from=init-data /init-data/data.tar.an* /init-data/.
COPY --link --from=init-data /init-data/data.tar.ao* /init-data/.

COPY <<-EOF copy.sh
	#!/bin/bash

	cd /data
	cat /init-data/data.tar.* | tar xvf -
	cd -
EOF
RUN chmod +x copy.sh

CMD [ "./copy.sh" ]
