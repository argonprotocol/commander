FROM oven/bun:1 as base

WORKDIR /usr/src/app

COPY . .

EXPOSE 8080
ENTRYPOINT [ "bun", "run", "server.ts" ]
