FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY . .

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN npm install -g bun
RUN pnpm install --frozen-lockfile
ENV MEDIAPULSE_ENV_BUILD_TARGETS=agents.data-collection
RUN pnpm exec turbo build --filter=@mediapulse/data-collection --env-mode=loose

FROM oven/bun:1
WORKDIR /app
USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends wget \
  && rm -rf /var/lib/apt/lists/*
USER bun
ENV NODE_ENV=production
ENV PORT=4001
EXPOSE 4001

COPY --from=builder /app/apps/mediapulse/agents/data-collection/dist/server.js ./server.js
CMD ["bun", "server.js"]
