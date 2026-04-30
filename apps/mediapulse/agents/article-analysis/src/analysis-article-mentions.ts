import {
  postAnalysisBodySchema,
  type PostAnalysisBody,
} from "@workspace/agent-data-api-contract";

import type { EntityProposal } from "./analysis-vocabulary.js";
import { normalizeEntityName } from "./normalize-entity-name.js";

/** One row for `postAnalysisBodySchema.articleEntities` (same shape as contract). */
export type ArticleEntityRow = PostAnalysisBody["articleEntities"][number];

/**
 * Proposal from LLM `articleMentions` before `dataSourceId` is injected.
 *
 * @see llmExtractionOutputSchema
 */
export type ArticleMentionProposal = Pick<
  ArticleEntityRow,
  "entityName" | "mentionCount" | "confidence" | "sentiment"
>;

/**
 * Builds the set of normalized names accepted for this article after per-article entity/relation caps.
 *
 * @param entities - Capped entity proposals for one source.
 * @returns Normalized canonical and alias strings.
 */
export const buildNormalizedEntityCatalogForArticle = (
  entities: readonly EntityProposal[],
): Set<string> => {
  const s = new Set<string>();
  for (const e of entities) {
    s.add(normalizeEntityName(e.canonicalName));
    for (const a of e.aliases) {
      s.add(normalizeEntityName(a));
    }
  }
  return s;
};

/**
 * Builds normalized name set for final run-level deduped entities (mentions must resolve after run caps).
 *
 * @param entities - Deduped and run-capped entities for the batch.
 * @returns Normalized catalog keys.
 */
export const buildNormalizedEntityCatalogFromProposals = (
  entities: readonly EntityProposal[],
): Set<string> => {
  return buildNormalizedEntityCatalogForArticle(entities);
};

/**
 * Keeps LLM mentions whose name appears in the per-article allowed set (after entity cap).
 *
 * @param mentions - Raw `articleMentions` for one source.
 * @param allowedNormalizedNames - Catalog from {@link buildNormalizedEntityCatalogForArticle}.
 * @returns Filtered mentions in input order.
 */
export const filterMentionsToArticleEntityCatalog = (
  mentions: readonly ArticleMentionProposal[],
  allowedNormalizedNames: ReadonlySet<string>,
): ArticleMentionProposal[] =>
  mentions.filter((m) =>
    allowedNormalizedNames.has(normalizeEntityName(m.entityName)),
  );

/**
 * Truncates mention list for one article to a max count (deterministic prefix order).
 *
 * @param mentions - Mentions already filtered to capped entities.
 * @param maxPerArticle - Config cap.
 * @returns Slice of mentions.
 */
export const applyPerArticleArticleMentionCap = (
  mentions: readonly ArticleMentionProposal[],
  maxPerArticle: number,
): ArticleMentionProposal[] => mentions.slice(0, maxPerArticle);

/**
 * Maps mention proposals to POST rows using the trusted `dataSourceId` for this source.
 *
 * @param dataSourceId - UUID of the `DataSource` row (never from the LLM).
 * @param mentions - Capped mention proposals.
 * @returns `articleEntities` payload rows.
 */
export const toArticleEntityRowsForSource = (
  dataSourceId: string,
  mentions: readonly ArticleMentionProposal[],
): ArticleEntityRow[] =>
  mentions.map((m) => ({
    dataSourceId,
    entityName: m.entityName.trim(),
    mentionCount: m.mentionCount,
    confidence: m.confidence,
    sentiment: m.sentiment,
  }));

/**
 * Drops mention rows whose `entityName` does not normalize-match the run-level entity catalog.
 *
 * @param rows - Merged `articleEntities` rows for the run.
 * @param catalog - Normalized keys from {@link buildNormalizedEntityCatalogFromProposals}.
 * @returns Kept rows and drop count (e.g. after run-level entity cap removed some entities).
 */
export const filterArticleEntityRowsToRunCatalog = (
  rows: readonly ArticleEntityRow[],
  catalog: ReadonlySet<string>,
): { rows: ArticleEntityRow[]; droppedCount: number } => {
  const out: ArticleEntityRow[] = [];
  let droppedCount = 0;
  for (const r of rows) {
    if (catalog.has(normalizeEntityName(r.entityName))) {
      out.push(r);
    } else {
      droppedCount += 1;
    }
  }
  return { rows: out, droppedCount };
};

/**
 * Canonicalizes mention row `entityName` values using run-level entity proposals.
 *
 * The analysis POST endpoint resolves `articleEntities.entityName` against ticker
 * entities persisted in prior chunks/rows. Sending canonical names avoids failures
 * when an alias (for example "VOI") was extracted but is not yet persisted as an
 * alias on a reused entity.
 *
 * @param rows - Mention rows after run-level filtering/caps.
 * @param entities - Final run-level entity proposals.
 * @returns Canonicalized rows, drop count for unmapped names, and rename count.
 */
export const canonicalizeArticleEntityRowsToRunEntities = (
  rows: readonly ArticleEntityRow[],
  entities: readonly EntityProposal[],
): {
  rows: ArticleEntityRow[];
  droppedCount: number;
  canonicalizedCount: number;
} => {
  const aliasToCanonical = new Map<string, string>();
  for (const entity of entities) {
    aliasToCanonical.set(
      normalizeEntityName(entity.canonicalName),
      entity.canonicalName.trim(),
    );
    for (const alias of entity.aliases) {
      aliasToCanonical.set(
        normalizeEntityName(alias),
        entity.canonicalName.trim(),
      );
    }
  }

  const out: ArticleEntityRow[] = [];
  let droppedCount = 0;
  let canonicalizedCount = 0;
  for (const row of rows) {
    const canonicalName = aliasToCanonical.get(
      normalizeEntityName(row.entityName),
    );
    if (!canonicalName) {
      droppedCount += 1;
      continue;
    }
    if (canonicalName !== row.entityName.trim()) {
      canonicalizedCount += 1;
    }
    out.push({
      ...row,
      entityName: canonicalName,
    });
  }
  return { rows: out, droppedCount, canonicalizedCount };
};

/**
 * Dedupes by (`dataSourceId`, normalized `entityName`). Sums `mentionCount`, takes max `confidence`,
 * keeps first non-undefined `sentiment` if any.
 *
 * @param rows - Rows possibly containing duplicates for the same source and entity.
 * @returns Deduplicated rows (Map iteration order).
 */
export const dedupeArticleEntityMentions = (
  rows: readonly ArticleEntityRow[],
): ArticleEntityRow[] => {
  const map = new Map<string, ArticleEntityRow>();
  for (const r of rows) {
    const key = `${r.dataSourceId}\0${normalizeEntityName(r.entityName)}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...r });
    } else {
      map.set(key, {
        ...existing,
        mentionCount: existing.mentionCount + r.mentionCount,
        confidence: Math.max(existing.confidence, r.confidence),
        sentiment: existing.sentiment ?? r.sentiment,
      });
    }
  }
  return [...map.values()];
};

/**
 * Applies run-level cap on total `articleEntities` rows after deduplication.
 *
 * @param rows - Deduped mention rows.
 * @param maxForRun - Maximum rows to keep (prefix order).
 * @returns Truncated rows.
 */
export const applyPerRunArticleEntityCap = (
  rows: readonly ArticleEntityRow[],
  maxForRun: number,
): ArticleEntityRow[] => rows.slice(0, maxForRun);

export type BuildArticleEntityPostChunksResult = {
  chunks: PostAnalysisBody[];
  parseErrors: string[];
};

/**
 * Partitions `articleEntities` into sequential POST bodies (`empty entities/relations/articleRelevances`).
 * Skips batches that fail `postAnalysisBodySchema.safeParse` and records error messages.
 *
 * @param tickerId - Ticker for each body.
 * @param articleEntities - Final rows to post.
 * @param postChunkArticleEntityBatchSize - Max rows per POST.
 * @returns Validated chunks and parse diagnostics.
 */
export const buildArticleEntityPostChunks = (
  tickerId: string,
  articleEntities: readonly ArticleEntityRow[],
  postChunkArticleEntityBatchSize: number,
): BuildArticleEntityPostChunksResult => {
  const chunks: PostAnalysisBody[] = [];
  const parseErrors: string[] = [];
  for (
    let i = 0;
    i < articleEntities.length;
    i += postChunkArticleEntityBatchSize
  ) {
    const window = articleEntities.slice(
      i,
      i + postChunkArticleEntityBatchSize,
    );
    const body: PostAnalysisBody = {
      tickerId,
      entities: [],
      relations: [],
      articleEntities: [...window],
      articleRelevances: [],
    };
    const parsed = postAnalysisBodySchema.safeParse(body);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        parseErrors.push(issue.message);
      }
      continue;
    }
    chunks.push(parsed.data);
  }
  return { chunks, parseErrors };
};
