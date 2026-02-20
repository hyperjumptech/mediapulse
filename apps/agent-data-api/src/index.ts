import { verifyAPIKey } from "@workspace/agent-utils";
import { logger } from "@workspace/logger";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { pinoLogger } from "hono-pino";
import { dataCollection } from "./routes/data-collection";
import { contentGeneration } from "./routes/content-generation";
import { delivery } from "./routes/delivery";

const app = new Hono();

app.use(pinoLogger({ pino: logger }));
app.use("*", bearerAuth({ verifyToken: async (token) => verifyAPIKey(token) }));

app.post("/data-collection", dataCollection);
app.post("/content-generation", contentGeneration);
app.post("/delivery", delivery);

export default app;
