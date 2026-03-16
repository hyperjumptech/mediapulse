# syntax = docker/dockerfile:1
ARG NODE_VERSION=24.12.0
FROM node:${NODE_VERSION}-slim AS builder
LABEL fly_launch_runtime="Next.js"

WORKDIR /app

ENV NODE_ENV="production"
ENV HOSTNAME="0.0.0.0"
ENV CI=true

RUN npm install -g pnpm

# Install build tools
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json ./

COPY packages ./packages
COPY apps ./apps

RUN pnpm install --frozen-lockfile

# Generate Prisma client (required by @workspace/database); dummy env is enough for generate
ENV DATABASE_URL="postgresql://localhost:5432/dummy"
ENV TEMP_ADMIN_USERNAME="dummy"
ENV TEMP_ADMIN_PASSWORD="dummy"
RUN pnpm --filter=@workspace/database run db:generate

RUN pnpm exec turbo build --filter=hermes

# Standalone runner: only copy traced output + static
ARG NODE_VERSION=24.12.0
FROM node:${NODE_VERSION}-slim AS runner
WORKDIR /app

ENV NODE_ENV="production"
ENV HOSTNAME="0.0.0.0"
ENV PORT=3001

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/hermes/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/hermes/.next/static ./apps/hermes/.next/static

USER nextjs

EXPOSE 3001
CMD ["node", "apps/hermes/server.js"]
