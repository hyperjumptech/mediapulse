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
    agentVersion: "3.0.0",
    description:
      "Loads unanalyzed articles and classifies each into exactly one newsletter section, or rejects it, with an AI fit score and reason, then persists section/sectionScore/sectionReason onto the data source and marks it analyzed.",
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
