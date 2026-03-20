import { logger as defaultLogger } from "@workspace/logger";
import OpenAI from "openai";
import { z } from "zod";
import {
  buildExtractionPrompt,
  type ExtractionArticle,
  type ExtractionEntityType,
  type ExtractionRelationType,
} from "./build-extraction-prompt.js";

const extractionResponseSchema = z.object({
  articles: z.array(
    z.object({
      articleId: z.string(),
      entities: z.array(
        z.object({
          name: z.string(),
          type: z.string(),
          aliases: z.array(z.string()).default([]),
          description: z.string().optional(),
        }),
      ),
      relations: z.array(
        z.object({
          from: z.string(),
          to: z.string(),
          relationType: z.string(),
        }),
      ),
    }),
  ),
});

type OpenAiLike = {
  chat: {
    completions: {
      create: (params: {
        model: string;
        messages: Array<{ role: "system" | "user"; content: string }>;
        response_format: { type: "json_object" };
      }) => Promise<{
        choices: Array<{ message?: { content?: string | null } }>;
      }>;
    };
  };
};

type LoggerLike = {
  warn: (obj: unknown, msg?: string) => void;
};

export type OpenAiConfig = {
  apiKey: string;
  model: string;
};

export type AnalysisDataSource = {
  id: string;
  title: string;
  url: string;
  content: string;
};

export type ExtractedEntityPayload = {
  canonicalName: string;
  typeId: string;
  description?: string;
  aliases: string[];
};

export type ExtractedRelationPayload = {
  fromEntityName: string;
  toEntityName: string;
  relationTypeId: string;
};

export type ExtractedArticleEntityPayload = {
  dataSourceId: string;
  entityName: string;
  mentionCount: number;
  confidence: number;
};

export type ExtractEntitiesResult = {
  entities: ExtractedEntityPayload[];
  relations: ExtractedRelationPayload[];
  articleEntities: ExtractedArticleEntityPayload[];
  articleEntityNamesByDataSourceId: Record<string, string[]>;
  failedArticleIds: string[];
};

/**
 * Extracts entities and relations from articles in batches, with per-article retry fallback.
 *
 * @param dataSources - Articles to extract.
 * @param entityTypes - Entity vocabulary.
 * @param relationTypes - Relation vocabulary.
 * @param openAiConfig - OpenAI API credentials and model from agent config.
 * @param openAiClient - Optional OpenAI client dependency.
 * @param logger - Optional logger dependency.
 * @param batchSize - Extraction batch size (recommended 3-5).
 * @returns Aggregated extraction payload for API persistence and scoring.
 */
export const extractEntities = async ({
  dataSources,
  entityTypes,
  relationTypes,
  openAiConfig,
  openAiClient,
  logger = defaultLogger,
  batchSize = 4,
}: {
  dataSources: AnalysisDataSource[];
  entityTypes: ExtractionEntityType[];
  relationTypes: ExtractionRelationType[];
  openAiConfig: OpenAiConfig;
  openAiClient?: OpenAiLike;
  logger?: LoggerLike;
  batchSize?: number;
}): Promise<ExtractEntitiesResult> => {
  const effectiveOpenAiClient =
    openAiClient ?? createOpenAiClient(openAiConfig.apiKey);

  const typeNameToId = new Map(
    entityTypes.map((entityType) => [entityType.name, entityType.id]),
  );
  const relationNameToId = new Map(
    relationTypes.map((relationType) => [relationType.name, relationType.id]),
  );

  const entities = new Map<string, ExtractedEntityPayload>();
  const relations = new Map<string, ExtractedRelationPayload>();
  const articleEntities = new Map<string, ExtractedArticleEntityPayload>();
  const articleEntityNamesByDataSourceId: Record<string, string[]> = {};
  const failedArticleIds: string[] = [];

  for (const batch of chunkArticles(dataSources, batchSize)) {
    try {
      const batchRows = await runExtractionForArticles({
        articles: batch,
        entityTypes,
        relationTypes,
        openAiClient: effectiveOpenAiClient,
        openAiModel: openAiConfig.model,
      });
      absorbExtractionRows({
        rows: batchRows,
        typeNameToId,
        relationNameToId,
        entities,
        relations,
        articleEntities,
        articleEntityNamesByDataSourceId,
        logger,
      });
    } catch (error) {
      logger.warn(
        { error, batchArticleIds: batch.map((article) => article.id) },
        "Batch extraction failed; retrying per article",
      );

      for (const article of batch) {
        try {
          const rows = await runExtractionForArticles({
            articles: [article],
            entityTypes,
            relationTypes,
            openAiClient: effectiveOpenAiClient,
            openAiModel: openAiConfig.model,
          });
          absorbExtractionRows({
            rows,
            typeNameToId,
            relationNameToId,
            entities,
            relations,
            articleEntities,
            articleEntityNamesByDataSourceId,
            logger,
          });
        } catch (articleError) {
          logger.warn(
            { articleId: article.id, error: articleError },
            "Article extraction failed; skipping article",
          );
          failedArticleIds.push(article.id);
        }
      }
    }
  }

  return {
    entities: Array.from(entities.values()),
    relations: Array.from(relations.values()),
    articleEntities: Array.from(articleEntities.values()),
    articleEntityNamesByDataSourceId,
    failedArticleIds,
  };
};

/**
 * Runs a single extraction call for one or many articles.
 *
 * @param articles - Articles included in this extraction call.
 * @param entityTypes - Entity vocabulary.
 * @param relationTypes - Relation vocabulary.
 * @param openAiClient - OpenAI client.
 * @param openAiModel - OpenAI model selected from agent config.
 * @returns Parsed extraction rows keyed by article id.
 */
const runExtractionForArticles = async ({
  articles,
  entityTypes,
  relationTypes,
  openAiClient,
  openAiModel,
}: {
  articles: ExtractionArticle[];
  entityTypes: ExtractionEntityType[];
  relationTypes: ExtractionRelationType[];
  openAiClient: OpenAiLike;
  openAiModel: string;
}): Promise<z.infer<typeof extractionResponseSchema>["articles"]> => {
  const prompt = buildExtractionPrompt({
    articles,
    entityTypes,
    relationTypes,
  });
  const response = await openAiClient.chat.completions.create({
    model: openAiModel,
    messages: [
      { role: "system", content: prompt.systemPrompt },
      { role: "user", content: prompt.userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty extraction response");
  }

  const parsed = parseExtractionResponse(content);
  return parsed.articles;
};

/**
 * Parses extraction JSON response content with Zod validation.
 *
 * @param raw - Raw JSON content from OpenAI.
 * @returns Parsed extraction payload.
 */
const parseExtractionResponse = (
  raw: string,
): z.infer<typeof extractionResponseSchema> => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenAI returned invalid JSON for extraction");
  }

  return extractionResponseSchema.parse(parsed);
};

/**
 * Absorbs parsed extraction rows into persistence payload maps.
 *
 * @param rows - Parsed extraction rows.
 * @param typeNameToId - Entity type lookup.
 * @param relationNameToId - Relation type lookup.
 * @param entities - Aggregated entity map.
 * @param relations - Aggregated relation map.
 * @param articleEntities - Aggregated article-entity map.
 * @param articleEntityNamesByDataSourceId - Entity names per article for scoring.
 * @param logger - Logger dependency.
 */
const absorbExtractionRows = ({
  rows,
  typeNameToId,
  relationNameToId,
  entities,
  relations,
  articleEntities,
  articleEntityNamesByDataSourceId,
  logger,
}: {
  rows: z.infer<typeof extractionResponseSchema>["articles"];
  typeNameToId: Map<string, string>;
  relationNameToId: Map<string, string>;
  entities: Map<string, ExtractedEntityPayload>;
  relations: Map<string, ExtractedRelationPayload>;
  articleEntities: Map<string, ExtractedArticleEntityPayload>;
  articleEntityNamesByDataSourceId: Record<string, string[]>;
  logger: LoggerLike;
}): void => {
  for (const row of rows) {
    const validEntityNames: string[] = [];
    const mentionCounts = new Map<string, number>();

    for (const entity of row.entities) {
      const typeId = typeNameToId.get(entity.type);
      if (!typeId) {
        logger.warn(
          {
            articleId: row.articleId,
            entityType: entity.type,
            entityName: entity.name,
          },
          "Skipping entity with unknown type",
        );
        continue;
      }

      const canonicalName = entity.name.trim();
      if (!canonicalName) {
        continue;
      }

      const aliases = uniqueNonEmpty([canonicalName, ...entity.aliases]);
      const entityKey = `${canonicalName.toLowerCase()}::${typeId}`;
      entities.set(entityKey, {
        canonicalName,
        typeId,
        description: entity.description?.trim() || undefined,
        aliases,
      });

      mentionCounts.set(
        canonicalName,
        (mentionCounts.get(canonicalName) ?? 0) + 1,
      );
      validEntityNames.push(canonicalName);
    }

    articleEntityNamesByDataSourceId[row.articleId] =
      uniqueNonEmpty(validEntityNames);

    for (const [entityName, mentionCount] of mentionCounts.entries()) {
      const articleEntityKey = `${row.articleId}::${entityName.toLowerCase()}`;
      articleEntities.set(articleEntityKey, {
        dataSourceId: row.articleId,
        entityName,
        mentionCount,
        confidence: 0.7,
      });
    }

    const validEntitySet = new Set(
      articleEntityNamesByDataSourceId[row.articleId],
    );
    for (const relation of row.relations) {
      const relationTypeId = relationNameToId.get(relation.relationType);
      if (!relationTypeId) {
        logger.warn(
          {
            articleId: row.articleId,
            relationType: relation.relationType,
          },
          "Skipping relation with unknown relation type",
        );
        continue;
      }
      if (
        !validEntitySet.has(relation.from) ||
        !validEntitySet.has(relation.to)
      ) {
        continue;
      }

      const relationKey = `${relation.from.toLowerCase()}::${relation.to.toLowerCase()}::${relationTypeId}`;
      relations.set(relationKey, {
        fromEntityName: relation.from,
        toEntityName: relation.to,
        relationTypeId,
      });
    }
  }
};

/**
 * Chunks articles into fixed-size batches.
 *
 * @param dataSources - Articles to chunk.
 * @param batchSize - Target chunk size.
 * @returns Chunked article arrays.
 */
const chunkArticles = (
  dataSources: AnalysisDataSource[],
  batchSize: number,
): ExtractionArticle[][] => {
  const size = Math.min(5, Math.max(3, batchSize));
  const chunks: ExtractionArticle[][] = [];
  for (let index = 0; index < dataSources.length; index += size) {
    chunks.push(
      dataSources.slice(index, index + size).map((row) => ({
        id: row.id,
        title: row.title,
        url: row.url,
        content: row.content,
      })),
    );
  }
  return chunks;
};

/**
 * Deduplicates and trims string entries.
 *
 * @param values - Candidate string values.
 * @returns Unique non-empty values.
 */
const uniqueNonEmpty = (values: string[]): string[] =>
  Array.from(
    new Set(
      values.map((value) => value.trim()).filter((value) => value.length > 0),
    ),
  );

/**
 * Creates a minimal OpenAI client adapter used by extraction calls.
 *
 * @param apiKey - OpenAI API key from agent config.
 * @returns OpenAI chat client with typed completion method.
 */
const createOpenAiClient = (apiKey: string): OpenAiLike =>
  new OpenAI({
    apiKey,
  }) as unknown as OpenAiLike;
