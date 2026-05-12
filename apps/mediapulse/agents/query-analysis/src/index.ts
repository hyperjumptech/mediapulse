import { createAgentApp, hermesTickerIdSchema } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-query-analysis";
import { z } from "zod";
import {
  queryAnalysisConfigSchema,
  type QueryAnalysisConfig,
} from "./config-schema";
import { runQueryAnalysis } from "./run";

const inputSchema = z.object({
  tickerId: hermesTickerIdSchema,
});

type InputSchema = z.infer<typeof inputSchema>;

const app = createAgentApp<
  InputSchema,
  typeof inputSchema,
  QueryAnalysisConfig,
  typeof queryAnalysisConfigSchema
>(
  {
    agentId: "query-analysis",
    agentVersion: "1.0.0",
    description:
      "Runs analytical and knowledge-graph queries for a ticker against stored Mediapulse data.",
    inputSchema,
    configSchema: queryAnalysisConfigSchema,
    run: runQueryAnalysis,
  },
  {
    authApiUrl: env.AGENT_AUTH_API_URL,
    autoRegister: {
      registryUrl: env.AGENT_REGISTRY_URL,
      domainIntegrationId: env.DOMAIN_INTEGRATION_ID,
      domainIntegrationApiKey: env.DOMAIN_INTEGRATION_API_KEY,
      agentUrl: env.AGENT_PUBLIC_URL,
    },
  },
);

export default {
  port: env.PORT ?? 4005,
  fetch: app.fetch,
};
