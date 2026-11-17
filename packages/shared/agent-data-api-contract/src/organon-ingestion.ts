import { z } from "zod";

export const ORGANON_INGESTION_CANDIDATES_MAX_TAKE = 500;
export const ORGANON_INGESTION_SENDS_MAX = 100;
export const ORGANON_INGESTION_RETRIES_MAX = 100;
export const ORGANON_INGESTION_SENT_ARTICLES_MAX_TAKE = 500;

export const getOrganonIngestionCandidatesQuerySchema = z.object({
  sendFrom: z.string().datetime(),
  lookbackDays: z.coerce.number().int().positive().max(30).default(7),
  take: z.coerce
    .number()
    .int()
    .positive()
    .max(ORGANON_INGESTION_CANDIDATES_MAX_TAKE)
    .default(200),
});

export const organonIngestionTickerSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
});

export const organonIngestionCandidateSchema = z.object({
  canonicalUrl: z.string(),
  url: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  content: z.string().nullable(),
  dataSourceId: z.string(),
  dataSourceIds: z.array(z.string()).min(1),
  publishedAt: z.string().datetime().nullable(),
  registrableDomain: z.string().nullable(),
  sectionScore: z.number().nullable(),
  tickers: z.array(organonIngestionTickerSchema).min(1),
  sentTickerSymbols: z.array(z.string()),
});

export const getOrganonIngestionCandidatesResponseSchema = z.object({
  candidates: z.array(organonIngestionCandidateSchema),
});

export const organonIngestionSendSchema = z.object({
  canonicalUrl: z.string().min(1),
  tickerSymbols: z.array(z.string().min(1)).min(1),
  organonJobId: z.string().min(1),
  sentAt: z.string().datetime(),
});

export const postOrganonIngestionSendsBodySchema = z
  .array(organonIngestionSendSchema)
  .min(1)
  .max(ORGANON_INGESTION_SENDS_MAX);

export const postOrganonIngestionSendsResponseSchema = z.object({
  recordedCount: z.number().int().nonnegative(),
});

export const getOrganonIngestionSendsQuerySchema = z.object({
  sentAfter: z.string().datetime(),
  sentBefore: z.string().datetime(),
  take: z.coerce
    .number()
    .int()
    .positive()
    .max(ORGANON_INGESTION_SENT_ARTICLES_MAX_TAKE)
    .default(200),
});

export const organonIngestionSentArticleSchema = z.object({
  canonicalUrl: z.string(),
  tickerSymbols: z.array(z.string()),
  organonJobId: z.string(),
  sentAt: z.string().datetime(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  content: z.string().nullable(),
});

export const getOrganonIngestionSendsResponseSchema = z.object({
  sends: z.array(organonIngestionSentArticleSchema),
});

export const postOrganonIngestionRetriesBodySchema = z.object({
  organonJobIds: z
    .array(z.string().min(1))
    .min(1)
    .max(ORGANON_INGESTION_RETRIES_MAX),
});

export const postOrganonIngestionRetriesResponseSchema = z.object({
  claimedJobIds: z.array(z.string()),
});

export type GetOrganonIngestionCandidatesQuery = z.infer<
  typeof getOrganonIngestionCandidatesQuerySchema
>;
export type OrganonIngestionTicker = z.infer<
  typeof organonIngestionTickerSchema
>;
export type OrganonIngestionCandidate = z.infer<
  typeof organonIngestionCandidateSchema
>;
export type GetOrganonIngestionCandidatesResponse = z.infer<
  typeof getOrganonIngestionCandidatesResponseSchema
>;
export type OrganonIngestionSend = z.infer<typeof organonIngestionSendSchema>;
export type PostOrganonIngestionSendsBody = z.infer<
  typeof postOrganonIngestionSendsBodySchema
>;
export type PostOrganonIngestionSendsResponse = z.infer<
  typeof postOrganonIngestionSendsResponseSchema
>;
export type GetOrganonIngestionSendsQuery = z.infer<
  typeof getOrganonIngestionSendsQuerySchema
>;
export type OrganonIngestionSentArticle = z.infer<
  typeof organonIngestionSentArticleSchema
>;
export type GetOrganonIngestionSendsResponse = z.infer<
  typeof getOrganonIngestionSendsResponseSchema
>;
export type PostOrganonIngestionRetriesBody = z.infer<
  typeof postOrganonIngestionRetriesBodySchema
>;
export type PostOrganonIngestionRetriesResponse = z.infer<
  typeof postOrganonIngestionRetriesResponseSchema
>;
