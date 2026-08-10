import { z } from "zod";

export const PUBLISHER_AUTHORITY_LOOKUP_MAX = 500;

export const PUBLISHER_AUTHORITY_DEFAULT_TTL_DAYS = 30;

export const postPublisherAuthorityStaleBodySchema = z.object({
  domains: z
    .array(z.string().trim().min(1))
    .max(PUBLISHER_AUTHORITY_LOOKUP_MAX),
  ttlDays: z
    .number()
    .int()
    .positive()
    .default(PUBLISHER_AUTHORITY_DEFAULT_TTL_DAYS),
});

export const postPublisherAuthorityStaleResponseSchema = z.object({
  domains: z.array(z.string()),
});

const publisherAuthorityRecordInputSchema = z.object({
  domain: z.string().trim().min(1),
  openPageRank: z.number().min(0).max(10).nullable(),
  globalRank: z.number().int().nonnegative().nullable(),
  referringDomains: z.number().int().nonnegative().nullable(),
  asOf: z.string().trim().min(1).nullable(),
});

export const postPublisherAuthorityBodySchema = z.array(
  publisherAuthorityRecordInputSchema,
);

export const postPublisherAuthorityResponseSchema = z.object({
  message: z.string(),
  recordedCount: z.number().int().nonnegative(),
});

export type PostPublisherAuthorityStaleBody = z.infer<
  typeof postPublisherAuthorityStaleBodySchema
>;
export type PostPublisherAuthorityStaleResponse = z.infer<
  typeof postPublisherAuthorityStaleResponseSchema
>;
export type PostPublisherAuthorityBody = z.infer<
  typeof postPublisherAuthorityBodySchema
>;
export type PostPublisherAuthorityResponse = z.infer<
  typeof postPublisherAuthorityResponseSchema
>;
export type PublisherAuthorityRecordInput = z.infer<
  typeof publisherAuthorityRecordInputSchema
>;
