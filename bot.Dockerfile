FROM node:20-slim AS base
WORKDIR /usr/src/app
RUN apt-get update && apt-get install -y curl \
  && corepack enable && corepack prepare yarn@stable --activate

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY .yarn/releases /temp/dev/.yarn/releases
COPY bot/package.json .yarnrc* /temp/dev/
RUN cd /temp/dev && yarn install

# install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
COPY .yarn/releases /temp/prod/.yarn/releases
COPY bot/package.json .yarnrc* /temp/prod/
ENV NODE_ENV=production
RUN cd /temp/prod && yarn install

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY --from=install /temp/prod/yarn.lock yarn.lock
COPY .yarn/releases .yarn/releases
COPY .yarnrc.yml .yarnrc.yml
COPY ./bot .

ENV NODE_ENV=production

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app .

EXPOSE 3000
ENTRYPOINT [ "yarn", "start" ]
