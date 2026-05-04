FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY . .

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN npm install -g bun
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @hermes/agent-auth-api build

FROM oven/bun:1
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

COPY --from=builder /app/apps/hermes/agent-auth-api/dist/server.js ./server.js
CMD ["bun", "server.js"]
