import { z } from "zod";

export const collectionGateStatusSchema = z.enum(["passed", "failed"]);

const pageCollectionArticleInputSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  description: z.string().optional(),
  content: z.string().optional(),
  author: z.string().optional(),
  source: z.string().optional(),
  curatedSourceListingUrl: z.string().url(),
  publishedAt: z.string().datetime().optional(),
  metadata: z.object({ provider: z.string().optional() }).optional(),
  collectionGateStatus: collectionGateStatusSchema.default("passed"),
  collectionGateReason: z.string().optional(),
});

export const postPageCollectionBodySchema = z.array(
  pageCollectionArticleInputSchema,
);

export const postPageCollectionResponseSchema = z.object({
  message: z.string(),
  persistedCount: z.number().int().nonnegative(),
});

/** Max URLs per global existing-url lookup request. */
export const PAGE_COLLECTION_EXISTING_URLS_MAX = 500;

export const postPageCollectionExistingUrlsBodySchema = z.object({
  urls: z.array(z.string().url()).max(PAGE_COLLECTION_EXISTING_URLS_MAX),
});

export const postPageCollectionExistingUrlsResponseSchema = z.object({
  existingUrls: z.array(z.string()),
});

export const postPageCollectionResolveSourcesBodySchema = z.object({
  listingUrls: z.array(z.string().url()),
});

export const curatedSourceLinkTypeSchema = z.enum(["page", "listing"]);

export const postPageCollectionResolveSourcesResponseSchema = z.object({
  sources: z.array(
    z.object({
      listingUrl: z.string().url(),
      curatedSourceId: z.string().uuid(),
      linkType: curatedSourceLinkTypeSchema,
      maxItems: z.number().int().positive().nullable(),
    }),
  ),
});

export const getPageCollectionArticlesQuerySchema = z.object({
  gateStatus: collectionGateStatusSchema.optional(),
  curatedSourceId: z.string().uuid().optional(),
  unanalyzed: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

export const pageCollectionArticleListItemSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  title: z.string(),
  collectionGateStatus: collectionGateStatusSchema.nullable(),
  collectionGateReason: z.string().nullable(),
  curatedSourceId: z.string().uuid().nullable(),
  curatedSourceListingUrl: z.string().nullable(),
  analyzedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});

export const getPageCollectionArticlesResponseSchema = z.object({
  items: z.array(pageCollectionArticleListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

export type PostPageCollectionBody = z.infer<
  typeof postPageCollectionBodySchema
>;
export type PostPageCollectionResponse = z.infer<
  typeof postPageCollectionResponseSchema
>;
export type PostPageCollectionExistingUrlsBody = z.infer<
  typeof postPageCollectionExistingUrlsBodySchema
>;
export type PostPageCollectionExistingUrlsResponse = z.infer<
  typeof postPageCollectionExistingUrlsResponseSchema
>;
export type PostPageCollectionResolveSourcesBody = z.infer<
  typeof postPageCollectionResolveSourcesBodySchema
>;
export type PostPageCollectionResolveSourcesResponse = z.infer<
  typeof postPageCollectionResolveSourcesResponseSchema
>;
export type GetPageCollectionArticlesQuery = z.infer<
  typeof getPageCollectionArticlesQuerySchema
>;
export type GetPageCollectionArticlesResponse = z.infer<
  typeof getPageCollectionArticlesResponseSchema
>;
