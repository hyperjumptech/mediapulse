FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY . .

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN npm install -g bun
RUN pnpm install --frozen-lockfile

ENV ORCHESTRATION_DATABASE_URL="postgresql://localhost:5432/dummy"
ENV TEMP_ADMIN_USERNAME="dummy"
ENV TEMP_ADMIN_PASSWORD="dummy"
ENV HERMES_ENV_BUILD_TARGETS=default,hermes.worker

RUN pnpm exec turbo build --filter=@hermes/worker --env-mode=loose

FROM oven/bun:1
WORKDIR /app
USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends wget curl \
  && rm -rf /var/lib/apt/lists/*
USER bun
ENV NODE_ENV=production

COPY --from=builder /app/apps/hermes/worker/dist/server.js ./server.js

# The worker writes /tmp/hermes-worker-heartbeat every 60 s.
# If the file is older than 2 minutes the event loop has hung; mark unhealthy
# so Docker / Kubernetes restarts the container.
# --start-period gives the worker time to connect to the DB before checks begin.
HEALTHCHECK --interval=60s --timeout=10s --start-period=60s --retries=3 \
  CMD test "$(find /tmp/hermes-worker-heartbeat -mmin -2 2>/dev/null | wc -l)" = "1"

CMD ["bun", "server.js"]
