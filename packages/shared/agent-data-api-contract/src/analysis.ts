import { z } from "zod";

import { NEWSLETTER_SECTION_IDS } from "./newsletter-sections.js";

/**
 * Max `limit` on analysis GET (query param). The article consumer
 * (`analysisGetDataSourceLimitMax` in Hermes config) should cap at this value so requests stay valid.
 */
export const ANALYSIS_GET_DATA_SOURCE_LIMIT_MAX = 10;

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

export const postAnalysisBodySchema = z.object({
  /** One classification row per scored article. `section: null` means the article was rejected. */
  articleSections: z
    .array(
      z.object({
        dataSourceId: z.string().uuid(),
        section: sectionEnum.nullable(),
        score: z.number().min(0).max(1),
        reason: z.string().trim().min(1).max(2000),
      }),
    )
    .default([]),
  /** Marks the processed articles as analyzed (covers rejected rows too). */
  analyzedDataSourceIds: z.array(z.string().uuid()).default([]),
});

/** Per-article issuer context for section classification (null for ticker-agnostic rows). */
export const analysisTickerContextSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  sector: z.string().nullable(),
  industry: z.string().nullable(),
  subIndustry: z.string().nullable(),
  businessActivity: z.string().nullable(),
});

export const analysisDataSourceSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  title: z.string(),
  content: z.string(),
  createdAt: z.coerce.date(),
  /** Issuer the article was collected for, or `null` when ticker-agnostic. */
  ticker: analysisTickerContextSchema.nullable(),
});

export const getAnalysisResponseSchema = z.object({
  dataSources: z.array(analysisDataSourceSchema),
  /** Count of data sources matching the GET filters (ignores `limit` on the request). */
  dataSourceTotalCount: z.number().int().nonnegative(),
});

export const postAnalysisResponseSchema = z.object({
  articlesScored: z.number().int().nonnegative(),
  /** Rows posted with `section: null`. */
  articlesRejected: z.number().int().nonnegative(),
});

export type AnalysisTickerContext = z.infer<typeof analysisTickerContextSchema>;
export type GetAnalysisQuery = z.infer<typeof getAnalysisQuerySchema>;
export type PostAnalysisBody = z.infer<typeof postAnalysisBodySchema>;
export type GetAnalysisResponse = z.infer<typeof getAnalysisResponseSchema>;
export type PostAnalysisResponse = z.infer<typeof postAnalysisResponseSchema>;
