FROM node:20-slim AS base

WORKDIR /usr/src/app

RUN apt-get update && \
  apt-get install -y curl docker.io && \
  corepack enable && corepack prepare yarn@stable --activate
  
COPY bot bot
COPY calculator calculator
COPY deploy/bot/package.json package.json
COPY deploy/bot/.yarnrc.yml .yarnrc.yml

ENV NODE_ENV=production
RUN yarn install

EXPOSE 3000
ENTRYPOINT [ "yarn", "start" ]
