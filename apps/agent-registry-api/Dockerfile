FROM oven/bun:1
WORKDIR /app

COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["bun", "run", "dist/server.js"]
