import { z } from "zod";

/**
 * All supported query-analysis intent labels (contract source of truth).
 *
 * Each intent is named for the newsletter section it feeds, so an intent *is* a section id.
 * `quickHits` is deliberately absent: it is a classification-time destination for articles that
 * fit no section, never something a query searches for.
 */
export const QUERY_ANALYSIS_INTENTS = [
  "industryPulse",
  "competitiveLandscape",
  "dealsAndMovements",
  "regulatoryPolicyWatch",
  "disruptorsOrTech",
] as const;

export const queryAnalysisIntentSchema = z.enum(QUERY_ANALYSIS_INTENTS);

export type QueryAnalysisIntent = z.infer<typeof queryAnalysisIntentSchema>;

export const getQueryAnalysisQuerySchema = z.object({
  tickerId: z.string().trim().min(1),
});

export const queryAnalysisPostQuerySchema = z.object({
  text: z.string().trim().min(1),
  intent: queryAnalysisIntentSchema,
  rank: z.number().int().positive(),
});

export const postQueryAnalysisBodySchema = z.object({
  tickerId: z.string().trim().min(1),
  queries: z.array(queryAnalysisPostQuerySchema).min(1),
  strategySnapshot: z.record(z.string(), z.unknown()),
  generationSource: z.string().trim().min(1),
  activate: z.boolean().default(true),
  agentJobId: z.string().trim().min(1).optional(),
  agentId: z.string().trim().min(1).optional(),
  agentVersion: z.string().trim().min(1).optional(),
});

export const queryAnalysisTickerSchema = z.object({
  id: z.string().uuid(),
  symbol: z.string(),
  name: z.string(),
  aliases: z.array(z.string()).default([]),
  sector: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  subSector: z.string().nullable().optional(),
  subIndustry: z.string().nullable().optional(),
  businessActivity: z.string().nullable().optional(),
});

export const tickerProfilePartySchema = z.object({
  name: z.string(),
  aliases: z.array(z.string()).default([]),
});

export const tickerProfileLabelSchema = z.object({
  indonesian: z.string(),
  english: z.string(),
});

export const queryAnalysisTickerProfileSchema = z.object({
  companyOverview: z.string(),
  businessOperation: z.string(),
  sector: tickerProfileLabelSchema,
  subSector: tickerProfileLabelSchema,
  industry: tickerProfileLabelSchema,
  subIndustry: tickerProfileLabelSchema,
  aliases: z.array(z.string()).default([]),
  competitors: z.array(tickerProfilePartySchema).default([]),
  regulators: z.array(tickerProfilePartySchema).default([]),
});

export const provenQuerySchema = z.object({
  text: z.string().trim().min(1),
  intent: queryAnalysisIntentSchema,
  novelArticleCount: z.number().int().nonnegative(),
});

export const getQueryAnalysisResponseSchema = z.object({
  ticker: queryAnalysisTickerSchema,
  profile: queryAnalysisTickerProfileSchema.nullable().default(null),
  provenQueries: z.array(provenQuerySchema).default([]),
});

export const postQueryAnalysisResponseSchema = z.object({
  created: z.number().int().nonnegative(),
  createdSetId: z.string().uuid(),
  activeSetId: z.string().uuid(),
});

export type ProvenQuery = z.infer<typeof provenQuerySchema>;
export type GetQueryAnalysisQuery = z.infer<typeof getQueryAnalysisQuerySchema>;
export type PostQueryAnalysisBody = z.infer<typeof postQueryAnalysisBodySchema>;
export type GetQueryAnalysisResponse = z.infer<
  typeof getQueryAnalysisResponseSchema
>;
export type PostQueryAnalysisResponse = z.infer<
  typeof postQueryAnalysisResponseSchema
>;
export type QueryAnalysisTickerProfile = z.infer<
  typeof queryAnalysisTickerProfileSchema
>;
export type TickerProfileParty = z.infer<typeof tickerProfilePartySchema>;
