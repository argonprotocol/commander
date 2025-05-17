# syntax = docker/dockerfile:latest

FROM --platform=linux/amd64 debian AS init-data
ARG TAR_PATHS

RUN --mount=type=bind,from=data,source=/,target=/data \
	mkdir /init-data && cd /data && \
	tar cvf - ${TAR_PATHS} | split --bytes=5GB - /init-data/data.tar.

########################

FROM --platform=linux/amd64 debian
LABEL org.opencontainers.image.source https://github.com/argonprotocol/commander-deploy
# Make sure we put everything is separate layers so we dont trigger rate limits
# We abuse wildcard here so it doesn't crash if some files don't exist
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

COPY <<-EOF copy.sh
	#!/bin/bash

	cd /data
	cat /init-data/data.tar.* | tar xvf -
	cd -
EOF
RUN chmod +x copy.sh

CMD [ "./copy.sh" ]