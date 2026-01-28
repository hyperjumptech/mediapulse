FROM oven/bun:1
WORKDIR /app

COPY . .

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["bun", "run", "dist/server.js"]
