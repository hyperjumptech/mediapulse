import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-article-analysis";
import { logger } from "@workspace/logger";

import {
  applyPerArticleExtractionCaps,
  applyPerRunCaps,
  dedupeEntities,
  dedupeRelations,
} from "./analysis-caps-dedupe.js";
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
import { buildArticleRelevancePostChunks } from "./analysis-relevance-post-chunks.js";
import {
  buildDraftRelevanceRow,
  validateRelevanceRowForPost,
  type PerSourceRelevanceSignals,
} from "./analysis-relevance-scoring.js";
import { applyRelevanceSelection } from "./analysis-relevance-selection.js";
import {
  validateExtractionVocabulary,
  type EntityProposal,
  type RelationProposal,
} from "./analysis-vocabulary.js";
import {
  executeAnalysisCreateWithTransientRetries,
  toArticleAnalysisPostFailureRecord,
} from "./article-analysis-agent-data-api-post.js";
import {
  deriveArticleAnalysisRunStatusLabel,
  isArticleAnalysisExtractionPolicyFailure,
  type ArticleAnalysisExtractionFailureRecord,
  type ArticleAnalysisPostFailureRecord,
} from "./article-analysis-run-policy.js";
import { buildAnalysisPostChunks } from "./build-analysis-post-chunks.js";
import {
  resolveArticleAnalysisConfig,
  toRelevanceWeightMapV1,
  type ArticleAnalysisConfig,
} from "./config-schema.js";
import type { ArticleAnalysisInput } from "./input-schema.js";
import {
  buildExtractionSystemContent,
  buildExtractionUserContent,
  extractEntitiesAndRelationsForSource,
} from "./llm-extract-entities.js";
import {
  buildAnalysisGetQuery,
  applyMaxBatchSizeCap,
  sortAnalysisDataSourcesByCreatedAt,
} from "./run-helpers.js";
import { normalizeEntityName } from "./normalize-entity-name.js";

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

const sleepMs = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs analysis: GET context, optional batch cap, LLM extraction per source,
 * vocabulary validation, caps, chunked POST of entities/relations, then chunked POST of
 * `articleEntities` (after ER commits), then chunked `articleRelevances` with canonical
 * `scoreBreakdown`, weighted `score`, and configurable `selected` (UTC-day budget from GET).
 *
 * Partial failure (MP-ART-ANALYSIS-007): optional `runPolicy` rejects the run when too few
 * sources extract successfully; vocabulary/LLM failures per source are recorded and skipped;
 * POST failures stop later phases and only API-confirmed counts are aggregated.
 * Successful extractions are canonicalized against existing KG entities (mainline behavior).
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
          runStatus: "success" as const,
          extractionFailures: [] as ArticleAnalysisExtractionFailureRecord[],
          extractionSuccessCount: 0,
          postFailures: [] as ArticleAnalysisPostFailureRecord[],
          vocabularyFailures: 0,
          entitiesCreated: 0,
          entitiesReused: 0,
          relationsCreated: 0,
          postChunks: 0,
          articleEntityRowsPosted: 0,
          mentionPostChunks: 0,
          articlesScored: 0,
          articlesSelected: 0,
          relevancePostChunks: 0,
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
          articlesScored: 0,
          articlesSelected: 0,
          relevancePostChunks: 0,
        },
      };
    }

    const systemContent = buildExtractionSystemContent(ctx);
    const existingLookup = buildExistingEntityLookup(ctx.existingEntities);

    const extractionFailures: ArticleAnalysisExtractionFailureRecord[] = [];
    let vocabularyFailures = 0;
    const mergedEntities: EntityProposal[] = [];
    const mergedRelations: RelationProposal[] = [];
    const mergedArticleEntityRows: ArticleEntityRow[] = [];
    const perSourceSignals: PerSourceRelevanceSignals[] = [];

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
          extractionFailures.push({
            dataSourceId: source.id,
            stage: "vocabulary",
            message: vocab.message,
          });
          logger.warn(
            {
              tickerId: input.tickerId,
              dataSourceId: source.id,
              stage: "vocabulary",
            },
            "article-analysis vocabulary validation failed for source; skipping",
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

        const avgMentionConfidence =
          mentionCapped.length === 0
            ? 0
            : mentionCapped.reduce((s, m) => s + m.confidence, 0) /
              mentionCapped.length;
        perSourceSignals.push({
          dataSourceId: source.id,
          createdAt: source.createdAt,
          url: source.url,
          entityCount: capped.entities.length,
          relationCount: capped.relations.length,
          mentionCount: mentionCapped.length,
          avgMentionConfidence,
          titleLower: source.title.toLowerCase(),
          textLower: truncated.toLowerCase(),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        extractionFailures.push({
          dataSourceId: source.id,
          stage: "llm",
          message,
        });
        logger.warn(
          {
            tickerId: input.tickerId,
            dataSourceId: source.id,
            stage: "llm",
            message,
          },
          "article-analysis LLM extraction failed for source; skipping",
        );
      }
    }

    const extractionSuccessCount = perSourceSignals.length;

    if (
      isArticleAnalysisExtractionPolicyFailure(
        extractionSuccessCount,
        cfg.runPolicy,
      )
    ) {
      return {
        success: false,
        message: `Article analysis run failed: only ${extractionSuccessCount} source(s) extracted successfully, but run policy requires at least ${cfg.runPolicy.minSuccessfulSources}.`,
        details: {
          extractionFailures,
          extractionSuccessCount,
          runPolicy: cfg.runPolicy,
          vocabularyFailures,
          articlesScored: 0,
          articlesSelected: 0,
          relevancePostChunks: 0,
          postFailures: [] as ArticleAnalysisPostFailureRecord[],
          dataSourcesProcessed: batch.length,
          reanalyze,
        },
      };
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

    const llmFailureCount = extractionFailures.filter(
      (f) => f.stage === "llm",
    ).length;

    if (entities.length === 0 && relations.length === 0) {
      const postFailures: ArticleAnalysisPostFailureRecord[] = [];
      return {
        success: true,
        message:
          llmFailureCount > 0 || extractionFailures.length > 0
            ? `no extraction produced (${extractionFailures.length} source(s) failed extraction; check logs)`
            : "extraction produced no entities or relations",
        details: {
          dataSourcesProcessed: batch.length,
          extractionFailures,
          extractionSuccessCount,
          postFailures,
          llmFailures: llmFailureCount,
          vocabularyFailures,
          runStatus: deriveArticleAnalysisRunStatusLabel(
            extractionFailures.length,
            postFailures.length,
          ),
          entitiesCreated: 0,
          entitiesReused: 0,
          relationsCreated: 0,
          postChunks: 0,
          articleEntityRowsPosted: 0,
          mentionPostChunks: 0,
          articlesScored: 0,
          articlesSelected: 0,
          relevancePostChunks: 0,
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
      const postFailures: ArticleAnalysisPostFailureRecord[] = [];
      return {
        success: true,
        message:
          "no valid POST chunks after extraction (check relation endpoint names vs entity canonicalName)",
        details: {
          dataSourcesProcessed: batch.length,
          relationCountAfterCaps: relations.length,
          droppedRelations,
          parseErrors: parseErrors.slice(0, 20),
          extractionFailures,
          extractionSuccessCount,
          postFailures,
          llmFailures: llmFailureCount,
          vocabularyFailures,
          runStatus: deriveArticleAnalysisRunStatusLabel(
            extractionFailures.length,
            postFailures.length,
          ),
          articleEntityRowsPosted: 0,
          mentionPostChunks: 0,
          droppedArticleMentionsNotInRunCatalog,
          articlesScored: 0,
          articlesSelected: 0,
          relevancePostChunks: 0,
          reanalyze,
        },
      };
    }

    const postFailures: ArticleAnalysisPostFailureRecord[] = [];
    let entitiesCreated = 0;
    let entitiesReused = 0;
    let relationsCreated = 0;
    let erPostChunksCompleted = 0;
    let erPhaseFailed = false;

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
      try {
        const res = await executeAnalysisCreateWithTransientRetries(
          () => dataApiClient.analysis.create(chunk),
          {
            maxRetries: cfg.postTransientRetries,
            baseDelayMs: cfg.postTransientRetryBaseDelayMs,
            sleep: sleepMs,
          },
        );
        entitiesCreated += res.entitiesCreated;
        entitiesReused += res.entitiesReused;
        relationsCreated += res.relationsCreated;
        erPostChunksCompleted += 1;
      } catch (err) {
        postFailures.push(
          toArticleAnalysisPostFailureRecord("entities_relations", i, err),
        );
        logger.warn(
          {
            tickerId: input.tickerId,
            chunkKind: "entities_relations",
            chunkIndex: i,
            err,
          },
          "article-analysis entities/relations POST failed; aborting remaining POST phases",
        );
        erPhaseFailed = true;
        break;
      }
    }

    let articleEntityRowsPosted = 0;
    let mentionPostChunksCompleted = 0;
    let mentionPhaseFailed = false;
    let articleEntityParseErrors: string[] = [];

    if (!erPhaseFailed) {
      const { chunks: articleEntityChunks, parseErrors } =
        buildArticleEntityPostChunks(
          input.tickerId,
          articleEntitiesForPost,
          cfg.postChunkArticleEntityBatchSize,
        );
      articleEntityParseErrors = parseErrors;

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
        try {
          await executeAnalysisCreateWithTransientRetries(
            () => dataApiClient.analysis.create(mentionChunk),
            {
              maxRetries: cfg.postTransientRetries,
              baseDelayMs: cfg.postTransientRetryBaseDelayMs,
              sleep: sleepMs,
            },
          );
          articleEntityRowsPosted += mentionChunk.articleEntities.length;
          mentionPostChunksCompleted += 1;
        } catch (err) {
          postFailures.push(
            toArticleAnalysisPostFailureRecord("article_entities", j, err),
          );
          logger.warn(
            {
              tickerId: input.tickerId,
              chunkKind: "article_entities",
              chunkIndex: j,
              err,
            },
            "article-analysis articleEntities POST failed; aborting relevance phase",
          );
          mentionPhaseFailed = true;
          break;
        }
      }
    }

    let articlesScoredTotal = 0;
    let articlesSelectedTotal = 0;
    let relevancePostChunksCompleted = 0;

    if (!erPhaseFailed && !mentionPhaseFailed && perSourceSignals.length > 0) {
      const weightMap = toRelevanceWeightMapV1(cfg);
      const relevanceDrafts = perSourceSignals.map((sig) =>
        buildDraftRelevanceRow(sig, cfg.scoreBreakdownVersion, weightMap),
      );
      const relevanceValidationErrors: string[] = [];
      for (const row of relevanceDrafts) {
        const vErr = validateRelevanceRowForPost(row, weightMap);
        if (vErr) {
          relevanceValidationErrors.push(`${row.dataSourceId}: ${vErr}`);
          logger.warn(
            { tickerId: input.tickerId, dataSourceId: row.dataSourceId, vErr },
            "article-analysis relevance row validation failed before selection",
          );
        }
      }
      if (relevanceValidationErrors.length > 0) {
        return {
          success: false,
          message:
            "article-analysis relevance row validation failed before selection",
          details: {
            tickerId: input.tickerId,
            validationErrorCount: relevanceValidationErrors.length,
            relevanceValidationErrors: relevanceValidationErrors.slice(0, 20),
          },
        };
      }

      const selectionInput = relevanceDrafts.map((row, idx) => ({
        ...row,
        _sortCreatedAt: perSourceSignals[idx]!.createdAt,
      }));
      const remainingBudget = Math.max(
        0,
        cfg.maxSelectedRelevancePerTickerPerDay -
          ctx.relevanceSelectionState.selectedCountToday,
      );
      const relevanceRows = applyRelevanceSelection(
        selectionInput,
        cfg.relevanceMinScore,
        remainingBudget,
      );

      const { chunks: relevanceChunks, parseErrors: relevanceParseErrors } =
        buildArticleRelevancePostChunks(
          input.tickerId,
          relevanceRows,
          cfg.postChunkArticleRelevanceBatchSize,
        );

      if (relevanceParseErrors.length > 0) {
        logger.warn(
          {
            tickerId: input.tickerId,
            parseErrorSample: relevanceParseErrors.slice(0, 10),
          },
          "article-analysis relevance chunk build reported parse issues",
        );
        return {
          success: false,
          message: "article-analysis relevance chunk parse failed",
          details: {
            tickerId: input.tickerId,
            parseErrorCount: relevanceParseErrors.length,
            relevanceParseErrors: relevanceParseErrors.slice(0, 20),
          },
        };
      }

      for (let k = 0; k < relevanceChunks.length; k++) {
        const relChunk = relevanceChunks[k]!;
        logger.info(
          {
            tickerId: input.tickerId,
            chunkKind: "article_relevances",
            chunkIndex: k,
            chunkArticleRelevances: relChunk.articleRelevances.length,
            model: cfg.openaiModel,
          },
          "article-analysis posting chunk",
        );
        try {
          const relRes = await executeAnalysisCreateWithTransientRetries(
            () => dataApiClient.analysis.create(relChunk),
            {
              maxRetries: cfg.postTransientRetries,
              baseDelayMs: cfg.postTransientRetryBaseDelayMs,
              sleep: sleepMs,
            },
          );
          articlesScoredTotal += relRes.articlesScored;
          articlesSelectedTotal += relRes.articlesSelected;
          relevancePostChunksCompleted += 1;
        } catch (err) {
          postFailures.push(
            toArticleAnalysisPostFailureRecord("article_relevances", k, err),
          );
          logger.warn(
            {
              tickerId: input.tickerId,
              chunkKind: "article_relevances",
              chunkIndex: k,
              err,
            },
            "article-analysis articleRelevances POST failed",
          );
          break;
        }
      }
    }

    const runStatus = deriveArticleAnalysisRunStatusLabel(
      extractionFailures.length,
      postFailures.length,
    );

    return {
      success: true,
      message: `complete (${runStatus}): ${erPostChunksCompleted}/${chunks.length} ER chunk(s), ${mentionPostChunksCompleted} articleEntity chunk(s), ${relevancePostChunksCompleted} relevance chunk(s); entitiesCreated=${entitiesCreated} entitiesReused=${entitiesReused} relationsCreated=${relationsCreated} articleEntityRowsPosted=${articleEntityRowsPosted} articlesScored=${articlesScoredTotal} articlesSelected=${articlesSelectedTotal}`,
      details: {
        dataSourcesProcessed: batch.length,
        dataSourcesReturned: ctx.dataSources.length,
        extractionFailures,
        extractionSuccessCount,
        postFailures,
        llmFailures: llmFailureCount,
        vocabularyFailures,
        runStatus,
        postChunks: erPostChunksCompleted,
        entitiesCreated,
        entitiesReused,
        relationsCreated,
        articleEntityRowsPosted,
        mentionPostChunks: mentionPostChunksCompleted,
        droppedArticleMentionsNotInRunCatalog,
        articlesScored: articlesScoredTotal,
        articlesSelected: articlesSelectedTotal,
        relevancePostChunks: relevancePostChunksCompleted,
        relevanceSelectionBudgetRemaining: Math.max(
          0,
          cfg.maxSelectedRelevancePerTickerPerDay -
            ctx.relevanceSelectionState.selectedCountToday,
        ),
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
