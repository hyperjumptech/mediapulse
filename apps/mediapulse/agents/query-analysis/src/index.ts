import { createAgentApp } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-query-analysis";

import {
  QueryAnalysisConfigSchema,
  type QueryAnalysisConfig,
} from "./config-schema.js";
import { InputSchema, type QueryAnalysisInput } from "./input-schema.js";
import { runQueryAnalysis } from "./run.js";

const app = createAgentApp<
  QueryAnalysisInput,
  typeof InputSchema,
  QueryAnalysisConfig,
  typeof QueryAnalysisConfigSchema
>(
  {
    agentId: "query-analysis",
    agentVersion: "1.0.0",
    description:
      "Generates versioned search query sets per ticker for data-collection (deterministic + optional LLM).",
    inputSchema: InputSchema,
    configSchema: QueryAnalysisConfigSchema,
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
            domainIntegrationId: env.DOMAIN_INTEGRATION_ID ?? "mediapulse",
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
