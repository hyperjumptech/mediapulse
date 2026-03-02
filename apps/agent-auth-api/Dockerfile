# Stage 1: install and build (monorepo context from repo root)
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY . .

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN npm install -g bun
RUN pnpm install --frozen-lockfile
RUN pnpm --filter agent-auth-api build

# Stage 2: run the built bundle only
FROM oven/bun:1
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

COPY --from=builder /app/apps/agent-auth-api/dist/server.js ./server.js
CMD ["bun", "server.js"]
