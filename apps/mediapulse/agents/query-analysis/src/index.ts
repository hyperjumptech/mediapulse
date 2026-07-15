import { createAgentApp, hermesTickerIdSchema } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-query-analysis";
import { z } from "zod";
import {
  queryAnalysisConfigSchema,
  type QueryAnalysisConfig,
} from "./config-schema";
import {
  QUERY_ANALYSIS_AGENT_ID,
  QUERY_ANALYSIS_AGENT_VERSION,
} from "./constants";
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
    agentVersion: "3.0.0",
    description:
      "Self-driving query-analysis: discovers competitors/regulators (contract-steered), probes query yield, and persists a ranked, section-covering query set.",
    inputSchema,
    configSchema: queryAnalysisConfigSchema,
    requireContract: true,
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
