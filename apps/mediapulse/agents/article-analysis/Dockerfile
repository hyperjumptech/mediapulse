FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY . .

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN npm install -g bun
RUN pnpm install --frozen-lockfile
ENV MEDIAPULSE_ENV_BUILD_TARGETS=agents.article-analysis
RUN pnpm exec turbo build --filter=@mediapulse/article-analysis --env-mode=loose

FROM oven/bun:1
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4011
EXPOSE 4011

COPY --from=builder /app/apps/mediapulse/agents/article-analysis/dist/server.js ./server.js
CMD ["bun", "server.js"]
