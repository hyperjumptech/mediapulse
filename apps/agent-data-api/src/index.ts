import { prisma } from "@workspace/prisma";
import * as crypto from "crypto";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";

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

app.get("/", (c) => {
  return c.text("What hath God wrought? -- sent from agent-data-api");
});

export default app;
