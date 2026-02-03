import { prisma } from "@workspace/prisma";
import * as crypto from "crypto";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { registerAgent } from "./routes/register-agent";
import { heartbeat } from "./routes/heartbeat";
import { deregister } from "./routes/deregister";
import { instances } from "./routes/instances";
import { registry } from "./routes/registry";

const app = new Hono();
const api = app.basePath("/api");

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
api.post("/agents/heartbeat", heartbeat);
api.post("/agents/deregister", deregister);
api.get("/agents/instances", instances);
api.get("/agents/registry", registry);

export default api;
