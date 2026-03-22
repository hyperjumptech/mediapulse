# Stage 1: install and build (monorepo context from repo root)
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY . .

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN npm install -g bun
RUN pnpm install --frozen-lockfile

# Generate Prisma client (orchestration DB)
ENV ORCHESTRATION_DATABASE_URL="postgresql://localhost:5432/dummy"
ENV MEDIAPULSE_DATABASE_URL="postgresql://localhost:5432/dummy"
RUN pnpm --filter=@hermes/orchestration-database run db:generate

RUN pnpm exec turbo build --filter=@hermes/agent-registry-api

# Stage 2: run the built bundle only
FROM oven/bun:1
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8082
EXPOSE 8082

COPY --from=builder /app/apps/hermes/agent-registry-api/dist/server.js ./server.js
CMD ["bun", "server.js"]
