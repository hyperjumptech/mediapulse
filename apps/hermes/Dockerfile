# syntax = docker/dockerfile:1
ARG NODE_VERSION=24.12.0
FROM node:${NODE_VERSION}-slim
LABEL fly_launch_runtime="Next.js"

WORKDIR /app

ENV NODE_ENV="production"
ENV HOSTNAME="0.0.0.0"

RUN npm install -g pnpm

# Install build tools
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./

COPY packages ./packages
COPY apps ./apps

RUN pnpm install --frozen-lockfile

# Generate Prisma client (required by @workspace/database); dummy env is enough for generate
ENV DATABASE_URL="postgresql://localhost:5432/dummy"
ENV TEMP_ADMIN_USERNAME="dummy"
ENV TEMP_ADMIN_PASSWORD="dummy"
RUN pnpm --filter=@workspace/database run db:generate

RUN pnpm --filter=hermes run build

RUN pnpm prune --prod

WORKDIR /app/apps/hermes

EXPOSE 3000
CMD [ "pnpm", "run", "start" ]
