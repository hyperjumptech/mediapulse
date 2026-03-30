# Stage 1: install and build (monorepo context from repo root)
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY . .

# pnpm for workspace install; bun for the app build
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN npm install -g bun
RUN pnpm install --frozen-lockfile
RUN pnpm --filter=@workspace/agent-auth-client run build
RUN pnpm exec turbo build --filter=@mediapulse/query-analysis --only --env-mode=loose

# Stage 2: run the built bundle only
FROM oven/bun:1
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4004
EXPOSE 4004

COPY --from=builder /app/apps/mediapulse/agents/query-analysis/dist/server.js ./server.js
CMD ["bun", "server.js"]
