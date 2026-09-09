import { z } from "zod";

export const PUBLISHER_SEEN_MAX = 500;

export const PUBLISHER_UNRESOLVED_DEFAULT_LIMIT = 25;

export const PUBLISHER_UNRESOLVED_MAX_LIMIT = 200;

export const PUBLISHER_NAMES_MAX = 200;

export const PUBLISHER_DISPLAY_NAME_MAX_CHARS = 80;

export const publisherNameSourceSchema = z.enum([
  "derived",
  "llm",
  "site_metadata",
  "manual",
]);

export const publisherDisplayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(PUBLISHER_DISPLAY_NAME_MAX_CHARS);

const publisherSeenItemSchema = z.object({
  domain: z.string().trim().min(1),
  displayName: publisherDisplayNameSchema,
});

export const postPublishersSeenBodySchema = z.object({
  publishers: z.array(publisherSeenItemSchema).max(PUBLISHER_SEEN_MAX),
});

export const postPublishersSeenResponseSchema = z.object({
  createdCount: z.number().int().nonnegative(),
  touchedCount: z.number().int().nonnegative(),
});

export const getPublishersUnresolvedQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(PUBLISHER_UNRESOLVED_MAX_LIMIT)
    .default(PUBLISHER_UNRESOLVED_DEFAULT_LIMIT),
});

export const getPublishersUnresolvedResponseSchema = z.object({
  publishers: z.array(
    z.object({
      domain: z.string(),
      displayName: z.string(),
    }),
  ),
});

const publisherNameItemSchema = z.object({
  domain: z.string().trim().min(1),
  displayName: publisherDisplayNameSchema,
  nameSource: publisherNameSourceSchema,
});

export const postPublisherNamesBodySchema = z.object({
  publishers: z.array(publisherNameItemSchema).max(PUBLISHER_NAMES_MAX),
});

export const postPublisherNamesResponseSchema = z.object({
  updatedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
});

export type PublisherNameSourceValue = z.infer<
  typeof publisherNameSourceSchema
>;
export type PublisherSeenItem = z.infer<typeof publisherSeenItemSchema>;
export type PublisherNameItem = z.infer<typeof publisherNameItemSchema>;
export type PostPublishersSeenBody = z.infer<
  typeof postPublishersSeenBodySchema
>;
export type PostPublishersSeenResponse = z.infer<
  typeof postPublishersSeenResponseSchema
>;
export type GetPublishersUnresolvedQuery = z.infer<
  typeof getPublishersUnresolvedQuerySchema
>;
export type GetPublishersUnresolvedResponse = z.infer<
  typeof getPublishersUnresolvedResponseSchema
>;
export type PostPublisherNamesBody = z.infer<
  typeof postPublisherNamesBodySchema
>;
export type PostPublisherNamesResponse = z.infer<
  typeof postPublisherNamesResponseSchema
>;
