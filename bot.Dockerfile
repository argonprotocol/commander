FROM node:20-slim AS base
WORKDIR /usr/src/app
RUN apt-get update && apt-get install -y curl \
  && corepack enable && corepack prepare yarn@stable --activate

COPY . .
COPY package.bot.json package.json
ENV NODE_ENV=production
RUN yarn install

EXPOSE 3000
ENTRYPOINT [ "yarn", "start" ]
