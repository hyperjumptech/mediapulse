import {
  AgentRunContext,
  dataApiGet,
  dataApiPost,
} from "@workspace/agent-runtime";
import { env } from "@workspace/env/agents-analysis";
import { logger } from "@workspace/logger";
import type { Config, Input } from "./index.js";
import { extractEntities } from "./extract-entities.js";
import {
  DEFAULT_SCORE_WEIGHTS,
  DEFAULT_TRUSTED_DOMAINS,
  scoreArticles,
} from "./score-articles.js";

type AnalysisContext = {
  dataSources: Array<{
    id: string;
    url: string;
    title: string;
    content: string;
    tickerId: string;
    createdAt: Date;
  }>;
  entityTypes: Array<{ id: string; name: string; description: string | null }>;
  relationTypes: Array<{
    id: string;
    name: string;
    description: string | null;
  }>;
  existingEntities: Array<{
    id: string;
    canonicalName: string;
    typeId: string;
    aliases: string[];
  }>;
};

type RunDependencies = {
  dataApiGetFn?: typeof dataApiGet;
  dataApiPostFn?: typeof dataApiPost;
};

/**
 * Runs analysis orchestration:
 * fetch context, extract entities, score/select articles, and persist in one POST.
 *
 * @param context - Agent run context.
 * @param dependencies - Optional injectable API dependencies.
 * @returns Success status; returns skipped on empty article list.
 */
export const run = async (
  { input, config, token }: AgentRunContext<Input, Config>,
  dependencies: RunDependencies = {},
) => {
  const { dataApiGetFn = dataApiGet, dataApiPostFn = dataApiPost } =
    dependencies;
  const resolvedConfig = {
    openAiApiKey: config.openAiApiKey,
    openAiModel: config.openAiModel,
    verbose: config.verbose ?? false,
    weights: {
      ...DEFAULT_SCORE_WEIGHTS,
      ...config.weights,
    },
    maxSelected: config.maxSelected ?? 10,
    minScoreThreshold: config.minScoreThreshold ?? 0.25,
    trustedDomains: {
      ...DEFAULT_TRUSTED_DOMAINS,
      ...config.trustedDomains,
    },
  };
  const analysisContext = await dataApiGetFn<AnalysisContext>(
    token,
    env.AGENT_DATA_API_URL,
    "/api/analysis",
    {
      tickerId: input.tickerId,
      unanalyzed: "true",
    },
  );

  if (analysisContext.dataSources.length === 0) {
    return { success: true, skipped: true };
  }

  const extractionResult = await extractEntities({
    dataSources: analysisContext.dataSources.map((row) => ({
      id: row.id,
      title: row.title,
      url: row.url,
      content: row.content,
    })),
    entityTypes: analysisContext.entityTypes,
    relationTypes: analysisContext.relationTypes,
    openAiConfig: {
      apiKey: resolvedConfig.openAiApiKey,
      model: resolvedConfig.openAiModel,
    },
  });

  const failedIds = new Set(extractionResult.failedArticleIds);
  const scorableArticles = analysisContext.dataSources
    .filter((row) => !failedIds.has(row.id))
    .map((row) => ({
      dataSourceId: row.id,
      url: row.url,
      title: row.title,
      content: row.content,
      createdAt: row.createdAt,
      extractedEntityNames:
        extractionResult.articleEntityNamesByDataSourceId[row.id] ?? [],
    }));

  const existingEntityNames = Array.from(
    new Set(
      analysisContext.existingEntities.flatMap((entity) => [
        entity.canonicalName,
        ...entity.aliases,
      ]),
    ),
  );

  const articleRelevances = scoreArticles({
    articles: scorableArticles,
    tickerAliases: existingEntityNames,
    existingEntityNames,
    config: {
      weights: resolvedConfig.weights,
      maxSelected: resolvedConfig.maxSelected,
      minScoreThreshold: resolvedConfig.minScoreThreshold,
      trustedDomains: resolvedConfig.trustedDomains,
    },
  });

  await dataApiPostFn(token, env.AGENT_DATA_API_URL, "/api/analysis", {
    tickerId: input.tickerId,
    entities: extractionResult.entities,
    relations: extractionResult.relations,
    articleEntities: extractionResult.articleEntities,
    articleRelevances,
  });

  if (resolvedConfig.verbose && extractionResult.failedArticleIds.length > 0) {
    logger.warn(
      { failedArticleIds: extractionResult.failedArticleIds },
      "Some articles failed extraction but remaining articles were scored",
    );
  }

  return { success: true };
};
