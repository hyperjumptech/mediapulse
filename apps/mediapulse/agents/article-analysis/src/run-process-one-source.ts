import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type { GetAnalysisResponse } from "@workspace/agent-data-api-contract";
import { computeLlmPromptFingerprint } from "@workspace/agent-llm-prompt-template";
import { NoObjectGeneratedError } from "ai";

import { applyPerArticleExtractionCaps } from "./analysis-caps-dedupe.js";
import {
  applyPerArticleArticleMentionCap,
  buildNormalizedEntityCatalogForArticle,
  filterMentionsToArticleEntityCatalog,
  toArticleEntityRowsForSource,
  type ArticleEntityRow,
} from "./analysis-article-mentions.js";
import {
  toEntityEvidenceRowsForSource,
  toRelationEvidenceRowsForSource,
  type EntityEvidenceRow,
  type RelationEvidenceRow,
} from "./analysis-provenance.js";
import type { PerSourceRelevanceSignals } from "./analysis-relevance-scoring.js";
import {
  partitionExtractionByVocabulary,
  validateExtractionVocabulary,
  type EntityProposal,
  type RelationProposal,
} from "./analysis-vocabulary.js";
import { toSafeLogError } from "./article-analysis-observability.js";
import type {
  ArticleAnalysisExtractionFailureRecord,
  ExtractionLlmFailureReason,
} from "./article-analysis-run-policy.js";
import type { ResolvedArticleAnalysisConfig } from "./config-schema.js";
import {
  buildArticleAnalysisExtractionUserContent,
  buildBrainstormSystemContent,
  buildBrainstormUserContent,
  applyRelationCritiqueDrops,
  buildRelationCritiqueModelMessages,
  classifyLlmExtractionError,
  classifyNoResponseSubtype,
  isCallTimeoutError,
  critiqueExtractedRelations,
  executeLlmCallWithTransientRetries,
  relationCritiqueRowKey,
  extractEntitiesAndRelationsForSource,
  fetchArticleBrainstorm,
  repairExtractionVocabulary,
  type LlmExtractionUsage,
} from "./llm-extract-entities.js";
import type { ExtractionExemplar } from "./exemplars/default-extraction-exemplars.js";
import {
  hardDeleteDataSourceById,
  shouldHardDeleteDataSourceForNonArticleReason,
  shouldHardDeleteDataSourceForExtractionError,
} from "./extraction-failure-pruning.js";
import {
  truncateArticleForExtraction,
  type TruncateArticleForExtractionMeta,
  type TruncationTickerContext,
} from "./utilities/article-content-truncator.js";
import {
  computeSourceQualityWithMeta,
  type HostTier,
  type SourceQualityComputeCtx,
} from "./utilities/source-quality.js";
import { buildEntityNamesForDiversification } from "./utilities/selection-diversification.js";
import {
  runArticleQualityGate,
  type QualityDropReason,
} from "./utilities/content-quality-gate.js";
import {
  applyExtractionEntityGrounding,
  type PerSourceGroundingCounters,
} from "./utilities/entity-grounding.js";

type ExistingEntity = {
  canonicalName: string;
  typeId: string;
  aliases: string[];
};

type AnalysisContext = Pick<
  GetAnalysisResponse,
  "ticker" | "entityTypes" | "relationTypes"
>;

type BatchSource = {
  id: string;
  url: string;
  title: string;
  content: string;
  createdAt: Date;
  publishedAt?: Date | null;
};

/** Per-source extraction deltas merged in original batch order after parallel walk. */
export type SourceProcessingOutcome = {
  mergedEntities: EntityProposal[];
  mergedRelations: RelationProposal[];
  mergedArticleEntityRows: ArticleEntityRow[];
  mergedEntityEvidence: EntityEvidenceRow[];
  mergedRelationEvidence: RelationEvidenceRow[];
  perSourceSignal?: PerSourceRelevanceSignals;
  extractionFailures: ArticleAnalysisExtractionFailureRecord[];
  droppedByContentQualityDelta: Partial<Record<QualityDropReason, number>>;
  truncationMeta?: TruncateArticleForExtractionMeta;
  groundingCounters?: PerSourceGroundingCounters;
  llmPromptFingerprint?: string;
  extractionUsage?: LlmExtractionUsage | null;
  repairUsage?: LlmExtractionUsage | null;
  brainstormUsage?: LlmExtractionUsage | null;
  critiqueUsage?: LlmExtractionUsage | null;
  extractionLatencyMs: number;
  extractionCalls: number;
  brainstormCalls: number;
  brainstormLatencyMs: number;
  critiqueLatencyMs: number;
  vocabularyFailures: number;
  badEntitiesDropped: number;
  badRelationsDropped: number;
  vocabularyRepairCallsAttempted: number;
  vocabularyRepairCallsSucceeded: number;
  vocabularyRepairCallsFailed: number;
  vocabularyRepairFailures: number;
  rowsRecoveredByRepair: number;
  relationsCritiquedSources: number;
  relationsCritiqueSkippedDueToDeadline: number;
  relationsDroppedByCritique: number;
  relationCritiqueCalls: number;
  sourceQualityTier?: HostTier;
  sourceQualityRecencyHours?: number | null;
  sourceQualityScore?: number;
  extractionRetryAttempts: number;
  extractionRetrySucceeded: boolean;
  extractionCallTimeouts: number;
};

/** Returns an empty per-source outcome for early-return paths. */
export const createEmptySourceProcessingOutcome =
  (): SourceProcessingOutcome => ({
    mergedEntities: [],
    mergedRelations: [],
    mergedArticleEntityRows: [],
    mergedEntityEvidence: [],
    mergedRelationEvidence: [],
    extractionFailures: [],
    droppedByContentQualityDelta: {},
    extractionLatencyMs: 0,
    extractionCalls: 0,
    brainstormCalls: 0,
    brainstormLatencyMs: 0,
    critiqueLatencyMs: 0,
    vocabularyFailures: 0,
    badEntitiesDropped: 0,
    badRelationsDropped: 0,
    vocabularyRepairCallsAttempted: 0,
    vocabularyRepairCallsSucceeded: 0,
    vocabularyRepairCallsFailed: 0,
    vocabularyRepairFailures: 0,
    rowsRecoveredByRepair: 0,
    relationsCritiquedSources: 0,
    relationsCritiqueSkippedDueToDeadline: 0,
    relationsDroppedByCritique: 0,
    relationCritiqueCalls: 0,
    extractionRetryAttempts: 0,
    extractionRetrySucceeded: false,
    extractionCallTimeouts: 0,
  });

export type ProcessOneSourceDeps = {
  cfg: ResolvedArticleAnalysisConfig;
  ctx: AnalysisContext;
  tickerId: string;
  systemContent: string;
  resolvedExemplars: readonly ExtractionExemplar[];
  existingLookup: ReadonlyMap<string, ExistingEntity>;
  truncationTickerContext: TruncationTickerContext;
  sourceQualityHostTiers: SourceQualityComputeCtx["hostTiers"];
  runStart: number;
  isRunDeadlineElapsed: () => boolean;
  sleep: (ms: number) => Promise<void>;
  resolveAgainstExistingEntities: (
    entities: readonly EntityProposal[],
    relations: readonly RelationProposal[],
    existingLookup: ReadonlyMap<string, ExistingEntity>,
  ) => { entities: EntityProposal[]; relations: RelationProposal[] };
  dataApiClient: Pick<
    ReturnType<typeof createAgentDataApiClient>,
    "analysisDataSourceDelete"
  >;
  log: {
    info: (obj: Record<string, unknown>, msg: string) => void;
    warn: (obj: Record<string, unknown>, msg: string) => void;
  };
  hardDeleteDataSource: typeof hardDeleteDataSourceById;
};

/**
 * Builds the per-source extraction worker used by bounded parallel dispatch.
 *
 * @param deps - Run-scoped config, context, and collaborators captured once per run.
 * @returns Async processor for one batch source returning mergeable deltas.
 */
export const createProcessOneSource =
  (deps: ProcessOneSourceDeps) =>
  async (source: BatchSource): Promise<SourceProcessingOutcome> => {
    const {
      cfg,
      ctx,
      tickerId,
      systemContent,
      resolvedExemplars,
      existingLookup,
      truncationTickerContext,
      sourceQualityHostTiers,
      isRunDeadlineElapsed,
      resolveAgainstExistingEntities,
      dataApiClient,
      log,
      hardDeleteDataSource,
      sleep,
    } = deps;

    const outcome = createEmptySourceProcessingOutcome();

    const qualityDecision = runArticleQualityGate(
      source.url,
      source.title,
      source.content,
    );
    if (qualityDecision.blocked) {
      const nonArticleReason: QualityDropReason = qualityDecision.reason;
      outcome.droppedByContentQualityDelta[nonArticleReason] = 1;
      outcome.extractionFailures.push({
        dataSourceId: source.id,
        stage: "prefilter",
        message: nonArticleReason,
      });
      log.info(
        {
          dataSourceId: source.id,
          stage: "prefilter",
          nonArticleReason,
        },
        "article-analysis skipped source with non-article prefilter",
      );
      if (shouldHardDeleteDataSourceForNonArticleReason(nonArticleReason)) {
        try {
          await hardDeleteDataSource(source.id, {
            dataApiClient,
            tickerId,
          });
          log.warn(
            {
              dataSourceId: source.id,
              stage: "prefilter",
              nonArticleReason,
            },
            "article-analysis hard-deleted data source after non-article prefilter",
          );
        } catch (deleteErr) {
          log.warn(
            {
              dataSourceId: source.id,
              stage: "prefilter",
              err: toSafeLogError(deleteErr),
              nonArticleReason,
            },
            "article-analysis failed to hard-delete data source after non-article prefilter",
          );
        }
      }
      return outcome;
    }

    const truncated = cfg.useStructureAwareTruncation
      ? (() => {
          const result = truncateArticleForExtraction(source.content, {
            maxChars: cfg.maxContentChars,
            tickerSymbols: truncationTickerContext.tickerSymbols,
            companyAliases: truncationTickerContext.companyAliases,
            leadParagraphsAlwaysKept: cfg.truncationLeadParagraphsAlwaysKept,
            financialKeywordsExtra: cfg.truncationFinancialKeywordsExtra,
          });
          outcome.truncationMeta = result.meta;
          return result.content;
        })()
      : source.content.length > cfg.maxContentChars
        ? source.content.slice(0, cfg.maxContentChars)
        : source.content;

    try {
      const t0 = Date.now();
      const extractionUserContent = buildArticleAnalysisExtractionUserContent({
        tickerId,
        tickerSymbol: ctx.ticker.symbol,
        tickerName: ctx.ticker.name,
        title: source.title,
        contentTruncated: truncated,
      });
      outcome.llmPromptFingerprint = computeLlmPromptFingerprint(
        systemContent,
        extractionUserContent,
      );

      let brainstormText: string | undefined;
      const shouldRunBrainstorm =
        cfg.useBrainstormPass && !isRunDeadlineElapsed();

      if (shouldRunBrainstorm) {
        try {
          const brainstormStartedAt = Date.now();
          const brainstormResult = await executeLlmCallWithTransientRetries(
            () =>
              fetchArticleBrainstorm({
                apiKey: cfg.openaiApiKey,
                model: cfg.brainstormModel,
                timeoutMs: cfg.extractionCallTimeoutMs,
                messages: [
                  {
                    role: "system",
                    content: buildBrainstormSystemContent(ctx),
                  },
                  {
                    role: "user",
                    content: buildBrainstormUserContent({
                      tickerId,
                      tickerSymbol: ctx.ticker.symbol,
                      tickerName: ctx.ticker.name,
                      title: source.title,
                      contentTruncated: truncated,
                    }),
                  },
                ],
              }),
            {
              maxRetries: cfg.extractionTransientRetries,
              baseDelayMs: cfg.extractionTransientRetryBaseDelayMs,
              maxDelayMs: cfg.extractionTransientRetryMaxDelayMs,
              sleep,
              classify: classifyLlmExtractionError,
              shouldAbort: isRunDeadlineElapsed,
              onRetry: (_attempt, error) => {
                if (isCallTimeoutError(error)) {
                  outcome.extractionCallTimeouts += 1;
                }
              },
            },
          );
          outcome.brainstormCalls = 1;
          outcome.brainstormLatencyMs = Date.now() - brainstormStartedAt;
          outcome.brainstormUsage = brainstormResult.usage;
          if (brainstormResult.text.trim().length > 0) {
            brainstormText = brainstormResult.text;
          }
        } catch (brainstormErr) {
          log.warn(
            {
              dataSourceId: source.id,
              stage: "brainstorm",
              err: toSafeLogError(brainstormErr),
            },
            "article-analysis brainstorm pass failed; falling back to single-pass extraction",
          );
        }
      } else if (cfg.useBrainstormPass && isRunDeadlineElapsed()) {
        log.warn(
          {
            dataSourceId: source.id,
            runElapsedMs: Date.now() - deps.runStart,
            runDeadlineMs: cfg.runDeadlineMs,
          },
          "article-analysis skipping brainstorm pass due to run deadline",
        );
      }

      let extractionRetryAttempts = 0;
      const extractedResult = await executeLlmCallWithTransientRetries(
        () =>
          extractEntitiesAndRelationsForSource({
            apiKey: cfg.openaiApiKey,
            model: cfg.openaiModel,
            timeoutMs: cfg.extractionCallTimeoutMs,
            messages: [
              { role: "system", content: systemContent },
              {
                role: "user",
                content: extractionUserContent,
              },
            ],
            ...(resolvedExemplars.length > 0
              ? { exemplars: resolvedExemplars }
              : {}),
            ...(brainstormText !== undefined ? { brainstormText } : {}),
          }),
        {
          maxRetries: cfg.extractionTransientRetries,
          baseDelayMs: cfg.extractionTransientRetryBaseDelayMs,
          maxDelayMs: cfg.extractionTransientRetryMaxDelayMs,
          sleep,
          classify: classifyLlmExtractionError,
          shouldAbort: isRunDeadlineElapsed,
          onRetry: (attempt, error) => {
            extractionRetryAttempts++;
            if (isCallTimeoutError(error)) {
              outcome.extractionCallTimeouts += 1;
            }
            const noResponseSubtype = classifyNoResponseSubtype(error);
            log.warn(
              {
                dataSourceId: source.id,
                stage: "extraction",
                retryAttempt: attempt,
                noResponseSubtype,
                err: toSafeLogError(error),
              },
              "article-analysis LLM extraction transient failure; retrying",
            );
          },
        },
      );
      outcome.extractionLatencyMs = Date.now() - t0;
      outcome.extractionCalls = 1;
      outcome.extractionUsage = extractedResult.usage;
      outcome.extractionRetryAttempts = extractionRetryAttempts;
      outcome.extractionRetrySucceeded = extractionRetryAttempts > 0;
      const extracted = extractedResult.object;

      let entitiesForPipeline: EntityProposal[] = [...extracted.entities];
      let relationsForPipeline: RelationProposal[] = [...extracted.relations];

      if (cfg.vocabularyPolicy === "strict") {
        const vocab = validateExtractionVocabulary(
          entitiesForPipeline,
          relationsForPipeline,
          ctx,
        );
        if (!vocab.ok) {
          outcome.vocabularyFailures = 1;
          outcome.extractionFailures.push({
            dataSourceId: source.id,
            stage: "vocabulary",
            message: vocab.message,
          });
          log.warn(
            {
              dataSourceId: source.id,
              stage: "vocabulary",
            },
            "article-analysis vocabulary validation failed for source; skipping",
          );
          return outcome;
        }
      } else {
        const partitioned = partitionExtractionByVocabulary(
          entitiesForPipeline,
          relationsForPipeline,
          ctx,
        );
        outcome.badEntitiesDropped = partitioned.badEntities.length;
        outcome.badRelationsDropped = partitioned.badRelations.length;
        entitiesForPipeline = [...partitioned.okEntities];
        relationsForPipeline = [...partitioned.okRelations];

        const rejectedCount =
          partitioned.badEntities.length + partitioned.badRelations.length;

        if (
          cfg.vocabularyPolicy === "repair" &&
          rejectedCount > 0 &&
          rejectedCount <= cfg.vocabularyRepairMaxItems
        ) {
          outcome.vocabularyRepairCallsAttempted = 1;
          try {
            const repairResult = await repairExtractionVocabulary({
              apiKey: cfg.openaiApiKey,
              model: cfg.vocabularyRepairModel,
              timeoutMs: cfg.extractionCallTimeoutMs,
              ctx,
              badEntities: partitioned.badEntities,
              badRelations: partitioned.badRelations,
            });
            outcome.repairUsage = repairResult.usage;

            const repairedPartition = partitionExtractionByVocabulary(
              repairResult.entities,
              repairResult.relations,
              ctx,
            );
            outcome.badEntitiesDropped += repairedPartition.badEntities.length;
            outcome.badRelationsDropped +=
              repairedPartition.badRelations.length;

            const recoveredCount =
              repairedPartition.okEntities.length +
              repairedPartition.okRelations.length;
            if (recoveredCount > 0) {
              outcome.vocabularyRepairCallsSucceeded = 1;
              outcome.rowsRecoveredByRepair = recoveredCount;
              entitiesForPipeline.push(...repairedPartition.okEntities);
              relationsForPipeline.push(...repairedPartition.okRelations);
            } else {
              outcome.vocabularyRepairCallsFailed = 1;
            }
          } catch (repairErr) {
            outcome.vocabularyRepairFailures = 1;
            outcome.vocabularyRepairCallsFailed = 1;
            log.warn(
              {
                dataSourceId: source.id,
                stage: "vocabulary_repair",
                err: toSafeLogError(repairErr),
              },
              "article-analysis vocabulary repair failed; keeping partitioned good rows only",
            );
          }
        } else if (
          cfg.vocabularyPolicy === "repair" &&
          rejectedCount > cfg.vocabularyRepairMaxItems
        ) {
          log.warn(
            {
              dataSourceId: source.id,
              rejectedCount,
              vocabularyRepairMaxItems: cfg.vocabularyRepairMaxItems,
            },
            "article-analysis skipping vocabulary repair due to rejected row cap",
          );
        }

        if (
          entitiesForPipeline.length === 0 &&
          relationsForPipeline.length === 0
        ) {
          log.warn(
            {
              dataSourceId: source.id,
              stage: "vocabulary",
              vocabularyPolicy: cfg.vocabularyPolicy,
            },
            "article-analysis no vocabulary-valid rows remain for source; skipping",
          );
          return outcome;
        }
      }

      const groundedExtraction = applyExtractionEntityGrounding({
        entities: entitiesForPipeline,
        relations: relationsForPipeline,
        mentions: extracted.articleMentions,
        articleText: source.content,
        title: source.title,
        policy: cfg.entityGroundingPolicy,
        entityGroundingMinTitleHits: cfg.entityGroundingMinTitleHits,
      });
      outcome.groundingCounters = groundedExtraction.counters;
      if (cfg.verbose && cfg.entityGroundingPolicy !== "off") {
        log.info(
          {
            dataSourceId: source.id,
            ungroundedEntityCount:
              groundedExtraction.counters.ungroundedEntityCount,
            relationsDroppedDueToUngroundedEndpoint:
              groundedExtraction.counters
                .relationsDroppedDueToUngroundedEndpoint,
            mentionsDroppedDueToUngroundedEntity:
              groundedExtraction.counters.mentionsDroppedDueToUngroundedEntity,
          },
          "article-analysis entity grounding applied for source",
        );
      }

      const resolved = resolveAgainstExistingEntities(
        groundedExtraction.entities,
        groundedExtraction.relations,
        existingLookup,
      );

      let relationsAfterCritique = resolved.relations;
      let relationEvidenceByKey: ReadonlyMap<string, string> | undefined;
      const critiqueEligible =
        cfg.useRelationSelfCritique &&
        resolved.relations.length >= cfg.relationCritiqueMinRelationCount;

      if (critiqueEligible && isRunDeadlineElapsed()) {
        outcome.relationsCritiqueSkippedDueToDeadline = 1;
        log.warn(
          {
            dataSourceId: source.id,
            runElapsedMs: Date.now() - deps.runStart,
            runDeadlineMs: cfg.runDeadlineMs,
            relationCount: resolved.relations.length,
          },
          "article-analysis skipping relation critique due to run deadline",
        );
      } else if (critiqueEligible) {
        try {
          const critiqueStartedAt = Date.now();
          const critiqueResult = await executeLlmCallWithTransientRetries(
            () =>
              critiqueExtractedRelations({
                apiKey: cfg.openaiApiKey,
                model: cfg.relationCritiqueModel,
                timeoutMs: cfg.extractionCallTimeoutMs,
                messages: buildRelationCritiqueModelMessages(ctx, {
                  articleTitle: source.title,
                  articleBody: source.content,
                  candidates: resolved.relations,
                }),
              }),
            {
              maxRetries: cfg.extractionTransientRetries,
              baseDelayMs: cfg.extractionTransientRetryBaseDelayMs,
              maxDelayMs: cfg.extractionTransientRetryMaxDelayMs,
              sleep,
              classify: classifyLlmExtractionError,
              shouldAbort: isRunDeadlineElapsed,
              onRetry: (_attempt, error) => {
                if (isCallTimeoutError(error)) {
                  outcome.extractionCallTimeouts += 1;
                }
              },
            },
          );
          outcome.relationCritiqueCalls = 1;
          outcome.critiqueLatencyMs = Date.now() - critiqueStartedAt;
          outcome.relationsCritiquedSources = 1;
          outcome.critiqueUsage = critiqueResult.usage;
          const critiqueApplied = applyRelationCritiqueDrops(
            resolved.relations,
            critiqueResult.ratings,
            cfg.relationCritiqueDropFraction,
          );
          outcome.relationsDroppedByCritique = critiqueApplied.droppedCount;
          relationsAfterCritique = critiqueApplied.relations;
          relationEvidenceByKey = critiqueApplied.evidenceByKey;
          for (const relation of resolved.relations) {
            const evidenceSpan = critiqueApplied.evidenceByKey.get(
              relationCritiqueRowKey(relation),
            );
            if (evidenceSpan !== undefined) {
              log.info(
                {
                  dataSourceId: source.id,
                  from: relation.fromEntityName,
                  to: relation.toEntityName,
                  relationTypeId: relation.relationTypeId,
                  evidenceSpan,
                },
                "article-analysis relation critique evidence",
              );
            }
          }
        } catch (critiqueErr) {
          log.warn(
            {
              dataSourceId: source.id,
              stage: "relation_critique",
              err: toSafeLogError(critiqueErr),
            },
            "article-analysis relation critique failed; keeping post-grounding relations",
          );
        }
      }

      const capped = applyPerArticleExtractionCaps(
        resolved.entities,
        relationsAfterCritique,
        cfg.maxEntitiesPerArticle,
        cfg.maxRelationsPerArticle,
      );
      outcome.mergedEntities = capped.entities;
      outcome.mergedRelations = capped.relations;

      const allowedCatalog = buildNormalizedEntityCatalogForArticle(
        capped.entities,
      );
      const mentionFiltered = filterMentionsToArticleEntityCatalog(
        groundedExtraction.mentions,
        allowedCatalog,
      );
      const mentionCapped = applyPerArticleArticleMentionCap(
        mentionFiltered,
        cfg.maxArticleEntitiesPerArticle,
      );
      outcome.mergedArticleEntityRows = toArticleEntityRowsForSource(
        source.id,
        mentionCapped,
      );
      outcome.mergedEntityEvidence = toEntityEvidenceRowsForSource(
        source.id,
        capped.entities,
        mentionCapped,
      );
      outcome.mergedRelationEvidence = toRelationEvidenceRowsForSource(
        source.id,
        capped.relations,
        relationEvidenceByKey,
      );

      const avgMentionConfidence =
        mentionCapped.length === 0
          ? 0
          : mentionCapped.reduce((s, m) => s + m.confidence, 0) /
            mentionCapped.length;

      if (cfg.useSourceQualityV2) {
        const qualityMeta = computeSourceQualityWithMeta(
          {
            url: source.url,
            title: source.title,
            content: source.content,
            createdAt: source.createdAt,
            publishedAt: source.publishedAt,
          },
          {
            now: new Date(),
            recencyHalfLifeHours: cfg.sourceQualityRecencyHalfLifeHours,
            hostTiers: sourceQualityHostTiers,
          },
        );
        outcome.sourceQualityScore = qualityMeta.qualityScore;
        outcome.sourceQualityTier = qualityMeta.hostTier;
        outcome.sourceQualityRecencyHours = qualityMeta.ageHours;
        if (cfg.verbose) {
          log.info(
            {
              dataSourceId: source.id,
              hostTier: qualityMeta.hostTier,
              hostClassScore: qualityMeta.hostClassScore,
              recencyScore: qualityMeta.recencyScore,
              ageHours: qualityMeta.ageHours,
              structuralScore: qualityMeta.structuralScore,
              qualityScore: qualityMeta.qualityScore,
            },
            "article-analysis source quality breakdown",
          );
        }
      }

      outcome.perSourceSignal = {
        dataSourceId: source.id,
        createdAt: source.createdAt,
        entityCount: capped.entities.length,
        relationCount: capped.relations.length,
        mentionCount: mentionCapped.length,
        avgMentionConfidence,
        titleLower: source.title.toLowerCase(),
        textLower: truncated.toLowerCase(),
        entityNames: buildEntityNamesForDiversification(
          capped.entities,
          mentionCapped.map((mention) => mention.entityName),
        ),
        ...(outcome.sourceQualityScore !== undefined
          ? { sourceQualityScore: outcome.sourceQualityScore }
          : {}),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const noResponseSubtype = classifyNoResponseSubtype(err);
      const isTimeout =
        message.includes("timed out") ||
        message.includes("ETIMEDOUT") ||
        message.includes("ECONNRESET");
      const llmFailureReason: ExtractionLlmFailureReason =
        NoObjectGeneratedError.isInstance(err)
          ? noResponseSubtype
          : isTimeout
            ? "timeout"
            : "other";
      const failureRecord: ArticleAnalysisExtractionFailureRecord = {
        dataSourceId: source.id,
        stage: "llm",
        message,
        reason: llmFailureReason,
      };
      if (NoObjectGeneratedError.isInstance(err)) {
        const outputTokens = err.usage?.outputTokens;
        if (outputTokens !== undefined) {
          failureRecord.outputTokens = outputTokens;
        }
      }
      outcome.extractionFailures.push(failureRecord);
      log.warn(
        {
          dataSourceId: source.id,
          stage: "llm",
          llmFailureReason,
          ...(NoObjectGeneratedError.isInstance(err)
            ? {
                finishReason: err.finishReason,
                outputTokens: err.usage?.outputTokens,
                responseTextLength: err.text?.length,
              }
            : {}),
          err: toSafeLogError(err),
        },
        "article-analysis LLM extraction failed for source; skipping",
      );
      if (shouldHardDeleteDataSourceForExtractionError(message)) {
        try {
          await hardDeleteDataSource(source.id, {
            dataApiClient,
            tickerId,
          });
          log.warn(
            {
              dataSourceId: source.id,
              stage: "llm",
            },
            "article-analysis hard-deleted data source after unrecoverable extraction parse failure",
          );
        } catch (deleteErr) {
          log.warn(
            {
              dataSourceId: source.id,
              stage: "llm",
              err: toSafeLogError(deleteErr),
            },
            "article-analysis failed to hard-delete data source after extraction parse failure",
          );
        }
      }
    }

    return outcome;
  };
