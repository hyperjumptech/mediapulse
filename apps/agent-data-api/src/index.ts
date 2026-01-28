import { verifyAPIKey } from "@workspace/agent-utils";

import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { dataCollection } from "./routes/data-collection";
import { contentGeneration } from "./routes/content-generation";
import { delivery } from "./routes/delivery";

const app = new Hono();
const api = app.basePath("/api");

api.use("*", bearerAuth({ verifyToken: async (token) => verifyAPIKey(token) }));

app.post("/data-collection", dataCollection);
app.post("/content-generation", contentGeneration);
app.post("/delivery", delivery);

export default app;
