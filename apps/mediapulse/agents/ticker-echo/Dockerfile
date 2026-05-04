FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY . .

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN npm install -g bun
RUN pnpm install --frozen-lockfile
RUN pnpm exec turbo build --filter=@mediapulse/ticker-echo --env-mode=loose

FROM oven/bun:1
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4010
EXPOSE 4010

COPY --from=builder /app/apps/mediapulse/agents/ticker-echo/dist/server.js ./server.js
CMD ["bun", "server.js"]
