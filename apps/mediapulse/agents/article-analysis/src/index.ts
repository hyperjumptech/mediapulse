import { createAgentApp } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-article-analysis";
import { z } from "zod";

import { articleAnalysisConfigSchema } from "./config-schema.js";
import {
  ARTICLE_ANALYSIS_AGENT_ID,
  ARTICLE_ANALYSIS_AGENT_VERSION,
} from "./constants.js";
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
    agentId: ARTICLE_ANALYSIS_AGENT_ID,
    agentVersion: ARTICLE_ANALYSIS_AGENT_VERSION,
    description:
      "Loads unanalyzed articles and, for each, has the model judge every per-section inclusion rule as matched or not. The winning section and a deterministic fit score (matched/total) are computed in code, then persisted as section/sectionScore/sectionReason plus a per-rule score breakdown, and the article is marked analyzed.",
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
