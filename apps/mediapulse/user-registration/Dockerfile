# syntax = docker/dockerfile:1
ARG NODE_VERSION=24.12.0
FROM node:${NODE_VERSION}-slim AS builder
LABEL fly_launch_runtime="Next.js"

WORKDIR /app

ENV NODE_ENV="production"
ENV HOSTNAME="0.0.0.0"
ENV CI=true

RUN npm install -g pnpm

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json ./

COPY packages ./packages
COPY apps ./apps

RUN pnpm install --frozen-lockfile

RUN rm -f apps/mediapulse/user-registration/.env apps/mediapulse/user-registration/.env.local && \
    touch apps/mediapulse/user-registration/.env apps/mediapulse/user-registration/.env.local

ENV MEDIAPULSE_ENV_BUILD_TARGETS=app.user-registration
ARG NEXT_PUBLIC_REGISTRATION_EMAIL=registration@example.com
ARG AGENT_DATA_API_URL=http://127.0.0.1:8081
ENV NEXT_PUBLIC_REGISTRATION_EMAIL=$NEXT_PUBLIC_REGISTRATION_EMAIL
ENV AGENT_DATA_API_URL=$AGENT_DATA_API_URL
RUN test -n "$NEXT_PUBLIC_REGISTRATION_EMAIL"
RUN test -n "$AGENT_DATA_API_URL"
RUN pnpm exec turbo build --filter=@mediapulse/user-registration --env-mode=loose

ARG NODE_VERSION=24.12.0
FROM node:${NODE_VERSION}-slim AS runner
WORKDIR /app

ENV NODE_ENV="production"
ENV HOSTNAME="0.0.0.0"
ENV PORT=3002

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/mediapulse/user-registration/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/mediapulse/user-registration/.next/static ./apps/mediapulse/user-registration/.next/static

USER nextjs

EXPOSE 3002
CMD ["node", "apps/mediapulse/user-registration/server.js"]
