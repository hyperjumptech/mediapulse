FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY . .

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN npm install -g bun
RUN pnpm install --frozen-lockfile

ENV ORCHESTRATION_DATABASE_URL="postgresql://localhost:5432/dummy"
ENV HERMES_ENV_BUILD_TARGETS=default

RUN pnpm exec turbo build --filter=@hermes/agent-registry-api --env-mode=loose

FROM oven/bun:1
WORKDIR /app
USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends wget curl \
  && rm -rf /var/lib/apt/lists/*
USER bun
ENV NODE_ENV=production
ENV PORT=8082
EXPOSE 8082

COPY --from=builder /app/apps/hermes/agent-registry-api/dist/server.js ./server.js
CMD ["bun", "server.js"]
