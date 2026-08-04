import { z } from "zod";

import { NEWSLETTER_SECTION_IDS } from "./newsletter-sections.js";

/**
 * Max `limit` on analysis GET (query param). The article consumer
 * (`analysisGetDataSourceLimitMax` in Hermes config) should cap at this value so requests stay valid.
 */
export const ANALYSIS_GET_DATA_SOURCE_LIMIT_MAX = 100;

const sectionEnum = z.enum(
  NEWSLETTER_SECTION_IDS as unknown as [string, ...string[]],
);

export const getAnalysisQuerySchema = z.object({
  /** Scope the query to one ticker (used for the data-collection daily baseline count). */
  tickerId: z.string().trim().min(1).optional(),
  /** Omitted query param defaults to incremental unanalyzed-only runs. */
  unanalyzed: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  /** Inclusive lower bound on `DataSource.createdAt` (ISO 8601). */
  start: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().datetime().optional(),
  ),
  /** Inclusive upper bound on `DataSource.createdAt` (ISO 8601). */
  end: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().datetime().optional(),
  ),
  /**
   * Max data sources returned (oldest first). Total matching rows (ignoring this cap) is
   * `dataSourceTotalCount` on the response. Upper bound is {@link ANALYSIS_GET_DATA_SOURCE_LIMIT_MAX}.
   */
  limit: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.coerce
      .number()
      .int()
      .positive()
      .max(ANALYSIS_GET_DATA_SOURCE_LIMIT_MAX)
      .optional(),
  ),
});

/**
 * Self-describing snapshot of the deterministic scoring for one (article, ticker) pair. Each
 * criterion embeds its `text` as evaluated so later config edits never re-interpret a stored row;
 * `criteriaHash` records which criteria version produced the score.
 */
export const postAnalysisScoreBreakdownSchema = z.object({
  /** Winning section, or `null` when the article was rejected. */
  section: sectionEnum.nullable(),
  /** Rules matched in the winning section (0 when rejected). */
  matched: z.number().int().nonnegative(),
  /** Total rules in the winning section (0 when rejected). */
  total: z.number().int().nonnegative(),
  /** Short hash of the acceptance-criteria set used for this classification. */
  criteriaHash: z.string(),
  /**
   * Per-rule breakdown across every section, so a reader can see why the winner won and why each
   * other section lost. Empty only when there was nothing to classify.
   */
  criteria: z.array(
    z.object({
      id: z.string(),
      section: sectionEnum,
      text: z.string(),
      /** Whether this rule is part of its section's gate rather than a strength signal. */
      qualifying: z.boolean().default(false),
      matched: z.boolean(),
      note: z.string(),
    }),
  ),
  /** Per-section tally and gate outcome, so a reader can see why the winning section won. */
  sections: z.array(
    z.object({
      section: sectionEnum,
      matched: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
      /** Whether every one of the section's qualifying rules matched. */
      qualified: z.boolean().default(false),
    }),
  ),
  /**
   * The global issuer-relevance gate judgment, which belongs to no section and so cannot live in
   * `criteria`. Absent when the caller ran without issuer context.
   *
   * `marketAnchors` counts the per-section rules that independently place the article in the
   * issuer's market. Two or more of them override a `matched: false` gate, so recording both the
   * raw judgment and the count is what makes an override auditable after the fact.
   */
  issuerRelevance: z
    .object({
      matched: z.boolean(),
      note: z.string(),
      marketAnchors: z.number().int().nonnegative(),
      /** Whether market anchors overrode a gate judgment of `false`. */
      overridden: z.boolean().default(false),
    })
    .optional(),
});

export const postAnalysisBodySchema = z.object({
  /**
   * One classification row per scored (article, ticker) pair. `section: null` means the article
   * was rejected for that ticker. The same article may appear once per active ticker.
   */
  articleSections: z
    .array(
      z.object({
        dataSourceId: z.string().uuid(),
        tickerId: z.string().uuid(),
        section: sectionEnum.nullable(),
        score: z.number().min(0).max(1),
        reason: z.string().trim().min(1).max(2000),
        /** Deterministic per-rule breakdown behind `score`/`reason`; optional for older posters. */
        scoreBreakdown: postAnalysisScoreBreakdownSchema.optional(),
      }),
    )
    .default([]),
  /** Marks the processed articles as analyzed at the article level (covers rejected rows too). */
  analyzedDataSourceIds: z.array(z.string().uuid()).default([]),
  /** Exact run that produced these classifications; stamped on each section row for provenance. */
  articleAnalysisRunId: z.string().uuid().optional(),
});

/** A company named in the issuer's profile, with the spellings it appears under in the press. */
export const analysisTickerPartySchema = z.object({
  name: z.string(),
  aliases: z.array(z.string()).default([]),
});

/** Per-article issuer context for section classification (null for ticker-agnostic rows). */
export const analysisTickerContextSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  sector: z.string().nullable(),
  industry: z.string().nullable(),
  subIndustry: z.string().nullable(),
  businessActivity: z.string().nullable(),
  /**
   * The issuer's own trading names, brands, and subsidiaries. Without these a classifier reads a
   * subsidiary's name (Telkomsel for TLKM) as a third party and mistakes the issuer for its own peer.
   */
  aliases: z.array(z.string()).default([]),
  /** Known peers from the issuer's profile, so peer rules match a list instead of a guess. */
  competitors: z.array(analysisTickerPartySchema).default([]),
});

export const analysisDataSourceSchema = z.object({
  id: z.string().uuid(),
  /** Active ticker this article is being classified against (one row per (article, ticker) pair). */
  tickerId: z.string().uuid(),
  url: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  content: z.string().nullable(),
  createdAt: z.coerce.date(),
  /** Issuer context for the paired ticker, used to ground section classification. */
  ticker: analysisTickerContextSchema,
});

export const getAnalysisResponseSchema = z.object({
  /** Candidate (article, ticker) pairs to classify (each carries its own issuer context). */
  dataSources: z.array(analysisDataSourceSchema),
  /** Count of (article, ticker) pairs matching the GET filters (ignores `limit` on the request). */
  dataSourceTotalCount: z.number().int().nonnegative(),
});

export const postAnalysisResponseSchema = z.object({
  articlesScored: z.number().int().nonnegative(),
  /** Rows posted with `section: null`. */
  articlesRejected: z.number().int().nonnegative(),
  skippedByCap: z.number().int().nonnegative().default(0),
  cappedTickerCount: z.number().int().nonnegative().default(0),
});

export type AnalysisTickerContext = z.infer<typeof analysisTickerContextSchema>;
export type AnalysisTickerParty = z.infer<typeof analysisTickerPartySchema>;
export type GetAnalysisQuery = z.infer<typeof getAnalysisQuerySchema>;
export type PostAnalysisScoreBreakdown = z.infer<
  typeof postAnalysisScoreBreakdownSchema
>;
export type PostAnalysisBody = z.infer<typeof postAnalysisBodySchema>;
export type GetAnalysisResponse = z.infer<typeof getAnalysisResponseSchema>;
export type PostAnalysisResponse = z.infer<typeof postAnalysisResponseSchema>;
