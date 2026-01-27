import { verifyAPIKey } from "@workspace/agent-utils";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";

const app = new Hono();

app.use(
  "*",
  bearerAuth({
    verifyToken: async (token, c) => verifyAPIKey(token),
  }),
);

app.post("/", (context) => {
  return context.text("data-collection-agent");
});

export default {
  port: 4000,
  fetch: app.fetch,
};
