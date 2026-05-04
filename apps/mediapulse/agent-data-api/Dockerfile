FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY . .

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN npm install -g bun
RUN pnpm install --frozen-lockfile

ENV MEDIAPULSE_DATABASE_URL="postgresql://localhost:5432/dummy"
ENV MEDIAPULSE_ENV_BUILD_TARGETS=default

RUN pnpm exec turbo build --filter=@mediapulse/agent-data-api --env-mode=loose

FROM oven/bun:1
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8081
EXPOSE 8081

COPY --from=builder /app/apps/mediapulse/agent-data-api/dist/server.js ./server.js
CMD ["bun", "server.js"]
