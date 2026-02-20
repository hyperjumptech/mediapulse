import { prisma } from "@workspace/database";
import { logger } from "@workspace/logger";
import * as crypto from "crypto";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { pinoLogger } from "hono-pino";
import { registerAgent } from "./routes/register-agent";

const app = new Hono();
const api = app.basePath("/api");

api.use(pinoLogger({ pino: logger }));

api.use(
  "*",
  bearerAuth({
    verifyToken: async (token, c) => {
      const hash = crypto.createHash("sha256").update(token).digest("hex");
      const apiKey = await prisma.aPIKey.findUnique({
        where: { key: hash },
        select: { userId: true, name: true },
      });

      return !!apiKey;
    },
  }),
);

api.post("/agents/register", registerAgent);

export default api;
