import { createAgentApp } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-query-analysis";
import { z } from "zod";
import {
  queryAnalysisConfigSchema,
  type QueryAnalysisConfig,
} from "./config-schema";
import { runQueryAnalysis } from "./run";

const inputSchema = z.object({
  tickerId: z.string().min(1),
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
    inputSchema,
    configSchema: queryAnalysisConfigSchema,
    run: runQueryAnalysis,
  },
  {
    authApiUrl: env.AGENT_AUTH_API_URL,
    autoRegister:
      env.AGENT_REGISTRY_URL &&
      env.DOMAIN_INTEGRATION_API_KEY &&
      env.AGENT_PUBLIC_URL
        ? {
            registryUrl: env.AGENT_REGISTRY_URL,
            domainIntegrationId: env.DOMAIN_INTEGRATION_ID,
            domainIntegrationApiKey: env.DOMAIN_INTEGRATION_API_KEY,
            agentUrl: env.AGENT_PUBLIC_URL,
          }
        : undefined,
  },
);

export default {
  port: env.PORT ?? 4005,
  fetch: app.fetch,
};
