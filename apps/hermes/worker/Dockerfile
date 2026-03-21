# Stage 1: install and build (monorepo context from repo root)
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY . .

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN npm install -g bun
RUN pnpm install --frozen-lockfile

# Generate Prisma client (required by @workspace/database)
ENV DATABASE_URL="postgresql://localhost:5432/dummy"
ENV TEMP_ADMIN_USERNAME="dummy"
ENV TEMP_ADMIN_PASSWORD="dummy"
RUN pnpm --filter=@workspace/database run db:generate

RUN pnpm exec turbo build --filter=hermes-worker

# Stage 2: run the built bundle only
FROM oven/bun:1
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/hermes/worker/dist/server.js ./server.js
CMD ["bun", "server.js"]
