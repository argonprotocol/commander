FROM node:20-slim AS base

WORKDIR /usr/src/app

RUN apt-get update && \
  apt-get install -y curl

COPY . .

EXPOSE 3000
ENTRYPOINT [ "node", "src/server.js" ]
