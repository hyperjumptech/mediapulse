import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.text("What hath God wrought? -- sent from agent-registry-api");
});

export default app;
