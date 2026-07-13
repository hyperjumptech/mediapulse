import { z } from "zod";

import { NEWSLETTER_SECTION_IDS } from "./newsletter-sections.js";

export const getContentGenerationQuerySchema = z.object({
  tickerId: z.string().trim().min(1),
});

export const postContentGenerationBodySchema = z.object({
  subject: z.string(),
  description: z.string().optional(),
  content: z.string(),
  tickerId: z.string().trim().min(1),
  model: z.string().optional(),
  agentVersion: z.string().optional(),
  configVersion: z.string().optional(),
  promptHash: z.string().optional(),
  configSnapshotId: z.string().optional(),
  promptTokens: z.number().int().nonnegative().optional(),
  completionTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
});

export const contentGenerationDataSourceSchema = z
  .object({
    dataSourceId: z.string().uuid(),
    url: z.string(),
    title: z.string(),
    content: z.string().nullable().optional(),
    author: z.string().nullable().optional(),
    source: z.string().nullable().optional(),
    tickerId: z.string().trim().min(1),
    /** Search query that surfaced the article; `null` for curated/global sources. */
    searchQueryId: z.string().uuid().nullable().optional(),
    description: z.string().nullable().optional(),
    /** Newsletter section assigned by article-analysis 3.0.0 (used to group sources at generation time). */
    section: z.enum(NEWSLETTER_SECTION_IDS as unknown as [string, ...string[]]),
    /** Section-fit score 0–1 (used for ordering within a section). */
    sectionScore: z.number().min(0).max(1).nullable().optional(),
    /** AI reason for the section assignment. */
    sectionReason: z.string().nullable().optional(),
  })
  .passthrough();

export const contentGenerationCompetitorSchema = z.object({
  name: z.string(),
  relation: z.string(),
});

export const getContentGenerationResponseSchema = z.object({
  dataSources: z.array(contentGenerationDataSourceSchema),
  tickerSymbol: z.string(),
  tickerName: z.string(),
  competitors: z.array(contentGenerationCompetitorSchema).default([]),
  issuerAliases: z.array(z.string()).default([]),
  /** Distinct non-English languages with an enabled subscription for this ticker (drives translation). */
  subscriberLanguages: z.array(z.string()).default([]),
});

export const postContentGenerationResponseSchema = z.object({
  message: z.string(),
});

export const CONTENT_GENERATION_FETCHED_CONTENT_MAX = 50;

export const contentGenerationFetchedContentItemSchema = z.object({
  dataSourceId: z.string().uuid(),
  content: z.string().min(1),
  fetchProvider: z.string().min(1),
});

export const postContentGenerationFetchedContentBodySchema = z
  .array(contentGenerationFetchedContentItemSchema)
  .min(1)
  .max(CONTENT_GENERATION_FETCHED_CONTENT_MAX);

export const postContentGenerationFetchedContentResponseSchema = z.object({
  updatedCount: z.number().int().nonnegative(),
});

export const getContentGenerationNewslettersLatestQuerySchema = z.object({
  tickerId: z.string().trim().min(1),
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
});

export const getContentGenerationNewslettersLatestResponseSchema = z.object({
  hasNewsletter: z.boolean(),
  newsletterId: z.string().nullable(),
});

export const getContentGenerationNewslettersRecentQuerySchema = z.object({
  tickerId: z.string().trim().min(1),
  /** Lookback window in calendar days (default 7). */
  days: z.coerce.number().int().positive().max(30).default(7),
});

export const contentGenerationNewsletterRecentItemSchema = z.object({
  subject: z.string(),
  createdAt: z.string().datetime(),
});

export const getContentGenerationNewslettersRecentResponseSchema = z.object({
  items: z.array(contentGenerationNewsletterRecentItemSchema),
});

export const getContentGenerationBulletsRecentQuerySchema = z.object({
  tickerId: z.string().trim().min(1),
  /** Lookback window in calendar days (default 14). */
  days: z.coerce.number().int().positive().max(90).default(14),
});

export const contentGenerationBulletRecentItemSchema = z.object({
  newsletterId: z.string(),
  sectionKey: z.string(),
  bulletText: z.string(),
  createdAt: z.string().datetime(),
});

export const getContentGenerationBulletsRecentResponseSchema = z.object({
  items: z.array(contentGenerationBulletRecentItemSchema),
});

export type GetContentGenerationQuery = z.infer<
  typeof getContentGenerationQuerySchema
>;
export type PostContentGenerationBody = z.infer<
  typeof postContentGenerationBodySchema
>;
export type GetContentGenerationResponse = z.infer<
  typeof getContentGenerationResponseSchema
>;
export type ContentGenerationCompetitor = z.infer<
  typeof contentGenerationCompetitorSchema
>;
export type PostContentGenerationResponse = z.infer<
  typeof postContentGenerationResponseSchema
>;
export type ContentGenerationFetchedContentItem = z.infer<
  typeof contentGenerationFetchedContentItemSchema
>;
export type PostContentGenerationFetchedContentBody = z.infer<
  typeof postContentGenerationFetchedContentBodySchema
>;
export type PostContentGenerationFetchedContentResponse = z.infer<
  typeof postContentGenerationFetchedContentResponseSchema
>;
export type GetContentGenerationNewslettersLatestQuery = z.infer<
  typeof getContentGenerationNewslettersLatestQuerySchema
>;
export type GetContentGenerationNewslettersLatestResponse = z.infer<
  typeof getContentGenerationNewslettersLatestResponseSchema
>;
export type GetContentGenerationNewslettersRecentQuery = z.infer<
  typeof getContentGenerationNewslettersRecentQuerySchema
>;
export type GetContentGenerationNewslettersRecentResponse = z.infer<
  typeof getContentGenerationNewslettersRecentResponseSchema
>;
export type GetContentGenerationBulletsRecentQuery = z.infer<
  typeof getContentGenerationBulletsRecentQuerySchema
>;
export type GetContentGenerationBulletsRecentResponse = z.infer<
  typeof getContentGenerationBulletsRecentResponseSchema
>;
