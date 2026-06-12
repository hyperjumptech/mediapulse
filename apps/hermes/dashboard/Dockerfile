# syntax = docker/dockerfile:1
ARG NODE_VERSION=24.12.0
FROM node:${NODE_VERSION}-slim AS builder
LABEL fly_launch_runtime="Next.js"

WORKDIR /app

ENV NODE_ENV="production"
ENV CI=true

RUN npm install -g pnpm

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json ./

COPY packages ./packages
COPY apps ./apps
COPY patches ./patches

RUN pnpm install --frozen-lockfile

ENV ORCHESTRATION_DATABASE_URL="postgresql://localhost:5432/dummy"
ENV TEMP_ADMIN_USERNAME="dummy"
ENV TEMP_ADMIN_PASSWORD="dummy"
ENV HERMES_INTERNAL_API_KEY="dummy-internal-key"
ENV HERMES_MCP_API_KEY_PEPPER="dummy-mcp-api-key-pepper"
ENV AGENT_AUTH_API_URL="http://localhost:8080"
ENV AGENT_AUTH_JWT_SECRET="dummy-jwt-secret-for-build"
# Optional product extension module and its env directory (set at image build for composed deployments).
ARG HERMES_DASHBOARD_EXTENSIONS=
ARG HERMES_DASHBOARD_EXTENSIONS_ENV_DIR=
ENV HERMES_DASHBOARD_EXTENSIONS="${HERMES_DASHBOARD_EXTENSIONS}"
ENV HERMES_DASHBOARD_EXTENSIONS_ENV_DIR="${HERMES_DASHBOARD_EXTENSIONS_ENV_DIR}"
RUN if [ -n "$HERMES_DASHBOARD_EXTENSIONS" ] && [ -n "$HERMES_DASHBOARD_EXTENSIONS_ENV_DIR" ] && [ ! -f "$HERMES_DASHBOARD_EXTENSIONS_ENV_DIR/.env" ]; then \
      printf '%s\n' \
        'MEDIAPULSE_DATABASE_URL=postgresql://localhost:5432/dummy' \
        'MEDIAPULSE_API_URL=http://localhost:8090' \
        'HERMES_API_URL=http://localhost:3001' \
        'DOMAIN_INTEGRATION_API_KEY=dummy-domain-integration-key' \
        'DOMAIN_INTEGRATION_ID=local-domain' \
        'UNSUBSCRIBE_SECRET=dummy-unsubscribe-secret' \
        'AGENT_DATA_API_URL=http://localhost:8081' \
        'MEDIAPULSE_CGA_DIAGNOSTICS_ENABLED=false' \
        > "$HERMES_DASHBOARD_EXTENSIONS_ENV_DIR/.env"; \
    fi
RUN rm -f apps/hermes/dashboard/.env apps/hermes/dashboard/.env.local && \
    touch apps/hermes/dashboard/.env apps/hermes/dashboard/.env.local

ENV HERMES_ENV_BUILD_TARGETS=default
RUN pnpm exec turbo build --filter=@hermes/dashboard --env-mode=loose

ARG NODE_VERSION=24.12.0
FROM node:${NODE_VERSION}-slim AS runner
WORKDIR /app

ENV NODE_ENV="production"
ENV PORT=3001

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/hermes/dashboard/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/hermes/dashboard/.next/static ./apps/hermes/dashboard/.next/static

RUN apt-get update \
  && apt-get install -y --no-install-recommends wget curl \
  && rm -rf /var/lib/apt/lists/*

USER nextjs

EXPOSE 3001
CMD ["node", "apps/hermes/dashboard/server.js"]
