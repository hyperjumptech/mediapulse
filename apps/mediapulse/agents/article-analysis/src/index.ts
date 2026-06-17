import { createAgentApp } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-article-analysis";
import { z } from "zod";

import { articleAnalysisConfigSchema } from "./config-schema.js";
import {
  articleAnalysisInputSchema,
  type ArticleAnalysisInput,
} from "./schemas/article-analysis-input-schema.js";
import { run } from "./run.js";

export type Input = ArticleAnalysisInput;
export type Config = z.infer<typeof articleAnalysisConfigSchema>;

const app = createAgentApp<
  Input,
  typeof articleAnalysisInputSchema,
  Config,
  typeof articleAnalysisConfigSchema
>(
  {
    agentId: "article-analysis",
    agentVersion: "2.0.0",
    description:
      "Loads analysis context incrementally (ticker-scoped or global page-collection backlog), extracts KG entities/relations and per-article entity mentions via LLM with vocabulary constraints, infers ticker associations in global mode, canonicalizes against existing KG entities, scores article relevance with canonical breakdown v1, and persists entities/relations, articleEntities, and articleRelevances in chunked POSTs to agent-data-api. Supports configurable runPolicy for partial extraction failure, per-chunk POST error isolation with optional transient retries, structured diagnostics (MP-ART-ANALYSIS-007), and structured run-summary observability with safe log fields (MP-ART-ANALYSIS-008).",
    inputSchema: articleAnalysisInputSchema,
    configSchema: articleAnalysisConfigSchema,
    run,
  },
  {
    authApiUrl: env.AGENT_AUTH_API_URL ?? "",
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
  port: env.PORT ?? 4010,
  fetch: app.fetch,
};
