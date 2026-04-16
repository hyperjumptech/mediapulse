import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-article-analysis";
import { logger } from "@workspace/logger";

import {
  applyPerArticleArticleMentionCap,
  applyPerRunArticleEntityCap,
  buildArticleEntityPostChunks,
  buildNormalizedEntityCatalogForArticle,
  buildNormalizedEntityCatalogFromProposals,
  dedupeArticleEntityMentions,
  filterArticleEntityRowsToRunCatalog,
  filterMentionsToArticleEntityCatalog,
  toArticleEntityRowsForSource,
  type ArticleEntityRow,
} from "./analysis-article-mentions.js";
import {
  applyPerArticleExtractionCaps,
  applyPerRunCaps,
  dedupeEntities,
  dedupeRelations,
} from "./analysis-caps-dedupe.js";
import {
  validateExtractionVocabulary,
  type EntityProposal,
  type RelationProposal,
} from "./analysis-vocabulary.js";
import { buildAnalysisPostChunks } from "./build-analysis-post-chunks.js";
import {
  resolveArticleAnalysisConfig,
  type ArticleAnalysisConfig,
} from "./config-schema.js";
import type { ArticleAnalysisInput } from "./input-schema.js";
import {
  buildExtractionSystemContent,
  buildExtractionUserContent,
  extractEntitiesAndRelationsForSource,
} from "./llm-extract-entities.js";
import { normalizeEntityName } from "./normalize-entity-name.js";
import {
  buildAnalysisGetQuery,
  applyMaxBatchSizeCap,
  sortAnalysisDataSourcesByCreatedAt,
} from "./run-helpers.js";

type ExistingEntity = {
  canonicalName: string;
  typeId: string;
  aliases: string[];
};

/**
 * Builds normalized lookup for existing canonical names and aliases.
 *
 * @param existingEntities - Entities returned by analysis GET.
 * @returns Normalized name/alias lookup for canonicalization.
 */
const buildExistingEntityLookup = (
  existingEntities: ReadonlyArray<ExistingEntity>,
): Map<string, ExistingEntity> => {
  const lookup = new Map<string, ExistingEntity>();
  const register = (rawName: string, entity: ExistingEntity) => {
    const normalized = normalizeEntityName(rawName);
    if (!lookup.has(normalized)) {
      lookup.set(normalized, entity);
    }
  };

  for (const entity of existingEntities) {
    register(entity.canonicalName, entity);
    for (const alias of entity.aliases) {
      register(alias, entity);
    }
  }

  return lookup;
};

/**
 * Canonicalizes extracted entities and relation endpoints using existing KG aliases/canonical names.
 *
 * @param entities - Extracted entities for one source.
 * @param relations - Extracted relations for one source.
 * @param existingLookup - Normalized lookup for existing entities.
 * @returns Canonicalized entities and relations.
 */
const resolveAgainstExistingEntities = (
  entities: readonly EntityProposal[],
  relations: readonly RelationProposal[],
  existingLookup: ReadonlyMap<string, ExistingEntity>,
): {
  entities: EntityProposal[];
  relations: RelationProposal[];
} => {
  const resolvedEntities = entities.map((entity) => {
    const directMatch = existingLookup.get(
      normalizeEntityName(entity.canonicalName),
    );
    const aliasMatch = entity.aliases
      .map((alias) => existingLookup.get(normalizeEntityName(alias)))
      .find((existing) => existing !== undefined);
    const match = directMatch ?? aliasMatch;

    if (!match) {
      return entity;
    }

    const aliases = new Set(entity.aliases);
    if (
      normalizeEntityName(entity.canonicalName) !==
      normalizeEntityName(match.canonicalName)
    ) {
      aliases.add(entity.canonicalName.trim());
    }

    return {
      ...entity,
      canonicalName: match.canonicalName,
      typeId: match.typeId,
      aliases: [...aliases],
    };
  });

  const resolveName = (name: string): string => {
    const resolved = existingLookup.get(normalizeEntityName(name));
    return resolved?.canonicalName ?? name;
  };

  const resolvedRelations = relations.map((relation) => ({
    ...relation,
    fromEntityName: resolveName(relation.fromEntityName),
    toEntityName: resolveName(relation.toEntityName),
  }));

  return {
    entities: resolvedEntities,
    relations: resolvedRelations,
  };
};

/**
 * Runs analysis: GET context, optional batch cap, LLM extraction per source,
 * vocabulary validation, canonicalization against existing entities, caps,
 * chunked POST of entities/relations, then chunked POST of `articleEntities`
 * (after ER commits so names resolve in the API). `articleRelevances` remain
 * empty until a later milestone.
 *
 * @param context - Hermes input/config and bearer token.
 * @returns Aggregated success with POST tallies or structured failure.
 */
export const run = async ({
  input,
  config,
  token,
}: AgentRunContext<
  ArticleAnalysisInput,
  ArticleAnalysisConfig
>): Promise<AgentRunResult> => {
  const reanalyze = input.reanalyze ?? false;
  const inputForQuery = { ...input, reanalyze };
  const cfg = resolveArticleAnalysisConfig(config);

  if (cfg.verbose) {
    logger.info(
      {
        tickerId: input.tickerId,
        openaiModel: cfg.openaiModel,
        maxContentChars: cfg.maxContentChars,
      },
      "article-analysis run started",
    );
  }

  const dataApiClient = createAgentDataApiClient({
    baseUrl: env.AGENT_DATA_API_URL,
    version: "v1",
    token,
  });

  try {
    const query = buildAnalysisGetQuery(inputForQuery);
    const ctx = await dataApiClient.analysis.get(query);

    const sorted = sortAnalysisDataSourcesByCreatedAt(ctx.dataSources);
    const batch = applyMaxBatchSizeCap(sorted, inputForQuery.maxBatchSize);

    if (batch.length === 0) {
      return {
        success: true,
        message: "analysis context loaded (0 source(s)); nothing to process",
        details: {
          dataSourcesReturned: ctx.dataSources.length,
          dataSourcesSelected: 0,
          reanalyze,
          entitiesCreated: 0,
          entitiesReused: 0,
          relationsCreated: 0,
          postChunks: 0,
          articleEntityRowsPosted: 0,
          mentionPostChunks: 0,
        },
      };
    }

    if (ctx.entityTypes.length === 0 || ctx.relationTypes.length === 0) {
      return {
        success: false,
        message:
          "KG vocabulary from analysis GET is empty (entityTypes or relationTypes); cannot extract",
        details: {
          entityTypeCount: ctx.entityTypes.length,
          relationTypeCount: ctx.relationTypes.length,
        },
      };
    }

    const systemContent = buildExtractionSystemContent(ctx);
    const existingLookup = buildExistingEntityLookup(ctx.existingEntities);

    let llmFailures = 0;
    let vocabularyFailures = 0;
    const mergedEntities: EntityProposal[] = [];
    const mergedRelations: RelationProposal[] = [];
    const mergedArticleEntityRows: ArticleEntityRow[] = [];

    for (const source of batch) {
      const truncated =
        source.content.length > cfg.maxContentChars
          ? source.content.slice(0, cfg.maxContentChars)
          : source.content;

      try {
        const extracted = await extractEntitiesAndRelationsForSource({
          apiKey: cfg.openaiApiKey,
          model: cfg.openaiModel,
          maxOutputTokens: cfg.maxOutputTokens,
          messages: [
            { role: "system", content: systemContent },
            {
              role: "user",
              content: buildExtractionUserContent({
                tickerId: input.tickerId,
                title: source.title,
                contentTruncated: truncated,
              }),
            },
          ],
        });

        const vocab = validateExtractionVocabulary(
          extracted.entities,
          extracted.relations,
          ctx,
        );
        if (!vocab.ok) {
          vocabularyFailures += 1;
          logger.warn(
            {
              tickerId: input.tickerId,
              dataSourceId: source.id,
              validationMessage: vocab.message,
            },
            "article-analysis skipped source due to vocabulary mismatch",
          );
          continue;
        }

        const resolved = resolveAgainstExistingEntities(
          extracted.entities,
          extracted.relations,
          existingLookup,
        );
        const capped = applyPerArticleExtractionCaps(
          resolved.entities,
          resolved.relations,
          cfg.maxEntitiesPerArticle,
          cfg.maxRelationsPerArticle,
        );
        mergedEntities.push(...capped.entities);
        mergedRelations.push(...capped.relations);

        const allowedCatalog = buildNormalizedEntityCatalogForArticle(
          capped.entities,
        );
        const mentionFiltered = filterMentionsToArticleEntityCatalog(
          extracted.articleMentions,
          allowedCatalog,
        );
        const mentionCapped = applyPerArticleArticleMentionCap(
          mentionFiltered,
          cfg.maxArticleEntitiesPerArticle,
        );
        mergedArticleEntityRows.push(
          ...toArticleEntityRowsForSource(source.id, mentionCapped),
        );
      } catch (err) {
        llmFailures += 1;
        logger.warn(
          { err, dataSourceId: source.id, tickerId: input.tickerId },
          "article-analysis LLM extraction failed for source; skipping",
        );
      }
    }

    let entities = dedupeEntities(mergedEntities);
    let relations = dedupeRelations(mergedRelations);
    const runCapped = applyPerRunCaps(
      entities,
      relations,
      cfg.maxEntitiesPerRun,
      cfg.maxRelationsPerRun,
    );
    entities = runCapped.entities;
    relations = runCapped.relations;

    if (entities.length === 0 && relations.length === 0) {
      return {
        success: true,
        message:
          llmFailures > 0
            ? `no extraction produced (${llmFailures} source(s) failed LLM; check logs)`
            : "extraction produced no entities or relations",
        details: {
          dataSourcesProcessed: batch.length,
          llmFailures,
          vocabularyFailures,
          entitiesCreated: 0,
          entitiesReused: 0,
          relationsCreated: 0,
          postChunks: 0,
          articleEntityRowsPosted: 0,
          mentionPostChunks: 0,
          reanalyze,
        },
      };
    }

    const entityCatalog = buildNormalizedEntityCatalogFromProposals(entities);
    const {
      rows: articleRowsForRun,
      droppedCount: droppedArticleMentionsNotInRunCatalog,
    } = filterArticleEntityRowsToRunCatalog(
      mergedArticleEntityRows,
      entityCatalog,
    );
    if (droppedArticleMentionsNotInRunCatalog > 0) {
      logger.warn(
        {
          tickerId: input.tickerId,
          droppedArticleMentionsNotInRunCatalog,
        },
        "article-analysis dropped article entity mentions not in run entity catalog",
      );
    }

    let articleEntitiesForPost = dedupeArticleEntityMentions(articleRowsForRun);
    articleEntitiesForPost = applyPerRunArticleEntityCap(
      articleEntitiesForPost,
      cfg.maxArticleEntitiesPerRun,
    );

    const { chunks, parseErrors, droppedRelations } = buildAnalysisPostChunks(
      input.tickerId,
      entities,
      relations,
      cfg.postChunkRelationBatchSize,
    );

    if (parseErrors.length > 0) {
      logger.warn(
        {
          tickerId: input.tickerId,
          parseErrorCount: parseErrors.length,
          droppedRelations,
        },
        "article-analysis chunk build reported issues",
      );
    }

    if (chunks.length === 0) {
      return {
        success: true,
        message:
          "no valid POST chunks after extraction (check relation endpoint names vs entity canonicalName)",
        details: {
          dataSourcesProcessed: batch.length,
          relationCountAfterCaps: relations.length,
          droppedRelations,
          parseErrors: parseErrors.slice(0, 20),
          llmFailures,
          vocabularyFailures,
          articleEntityRowsPosted: 0,
          mentionPostChunks: 0,
          droppedArticleMentionsNotInRunCatalog,
          reanalyze,
        },
      };
    }

    let entitiesCreated = 0;
    let entitiesReused = 0;
    let relationsCreated = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      logger.info(
        {
          tickerId: input.tickerId,
          chunkKind: "entities_relations",
          chunkIndex: i,
          chunkEntities: chunk.entities.length,
          chunkRelations: chunk.relations.length,
          model: cfg.openaiModel,
        },
        "article-analysis posting chunk",
      );
      const res = await dataApiClient.analysis.create(chunk);
      entitiesCreated += res.entitiesCreated;
      entitiesReused += res.entitiesReused;
      relationsCreated += res.relationsCreated;
    }

    let articleEntityRowsPosted = 0;
    let mentionPostChunks = 0;
    const {
      chunks: articleEntityChunks,
      parseErrors: articleEntityParseErrors,
    } = buildArticleEntityPostChunks(
      input.tickerId,
      articleEntitiesForPost,
      cfg.postChunkArticleEntityBatchSize,
    );

    if (articleEntityParseErrors.length > 0) {
      logger.warn(
        {
          tickerId: input.tickerId,
          parseErrorSample: articleEntityParseErrors.slice(0, 10),
        },
        "article-analysis articleEntity chunk build reported parse issues",
      );
    }

    for (let j = 0; j < articleEntityChunks.length; j++) {
      const mentionChunk = articleEntityChunks[j]!;
      logger.info(
        {
          tickerId: input.tickerId,
          chunkKind: "article_entities",
          chunkIndex: j,
          chunkArticleEntities: mentionChunk.articleEntities.length,
          model: cfg.openaiModel,
        },
        "article-analysis posting chunk",
      );
      await dataApiClient.analysis.create(mentionChunk);
      articleEntityRowsPosted += mentionChunk.articleEntities.length;
    }
    mentionPostChunks = articleEntityChunks.length;

    return {
      success: true,
      message: `analysis complete: ${chunks.length} ER chunk(s), ${mentionPostChunks} articleEntity chunk(s); entitiesCreated=${entitiesCreated} entitiesReused=${entitiesReused} relationsCreated=${relationsCreated} articleEntityRowsPosted=${articleEntityRowsPosted}`,
      details: {
        dataSourcesProcessed: batch.length,
        dataSourcesReturned: ctx.dataSources.length,
        postChunks: chunks.length,
        entitiesCreated,
        entitiesReused,
        relationsCreated,
        articleEntityRowsPosted,
        mentionPostChunks,
        droppedArticleMentionsNotInRunCatalog,
        llmFailures,
        vocabularyFailures,
        droppedRelations,
        articleEntityParseErrors: articleEntityParseErrors.slice(0, 20),
        reanalyze,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "agent-data-api article-analysis run failed";
    logger.error({ tickerId: input.tickerId, err: error }, message);
    return { success: false, message };
  }
};
