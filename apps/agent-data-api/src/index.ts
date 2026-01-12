import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.text("What hath God wrought? -- sent from agent-data-api");
});

export default app;
