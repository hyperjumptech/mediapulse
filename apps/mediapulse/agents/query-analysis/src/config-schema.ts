import { z } from "zod";

/**
 * Runtime config for the query-analysis agent, supplied by Hermes on each invocation
 * (from the admin-selected agent config for the pipeline step).
 *
 * All query-generation settings live here rather than in environment variables so admins
 * can tune them from the Hermes dashboard without a code deploy.
 */
export const ConfigSchema = z.object({
  /** OpenAI API key for LLM query generation. */
  openaiApiKey: z.string().min(1),
  /** Chat model id (e.g. gpt-4o-mini). Defaults to gpt-4o-mini when omitted. */
  openaiModel: z.string().min(1).optional(),
  /** Total queries per generated set. */
  queryCount: z.number().int().positive().default(12),
  /** Minimum number of deterministic (template-based) queries in each set. */
  minDeterministicCount: z.number().int().nonnegative().default(4),
  /** Allowed language codes for generated queries (e.g. ["en"]). */
  allowedLanguages: z.array(z.string()).default(["en"]),
  /** Scoring weight for breaking-news intent queries. */
  weightBreaking: z.number().nonnegative().default(3),
  /** Scoring weight for knowledge-graph-change intent queries. */
  weightKgChange: z.number().nonnegative().default(2),
  /** Scoring weight for fundamental-analysis intent queries. */
  weightFundamental: z.number().nonnegative().default(1),
  /** Max tokens for the LLM query-generation call. */
  maxTokens: z.number().int().positive().default(1024),
});

export type QueryAnalysisConfig = z.infer<typeof ConfigSchema>;
