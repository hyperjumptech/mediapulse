import type { Context } from "hono";

import {
  getPageCollectionArticlesQuerySchema,
  postPageCollectionBodySchema,
  postPageCollectionExistingUrlsBodySchema,
  postPageCollectionResolveSourcesBodySchema,
} from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";

import {
  listPageCollectionArticles,
  lookupGlobalExistingUrls,
  persistPageCollectionArticles,
  resolveCuratedSourcesByListingUrls,
} from "../services/page-collection.js";

/** POST /page-collection — persist ticker-agnostic articles. */
export async function postPageCollection(context: Context): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await postPageCollectionBodySchema.parseAsync(body);
    const persistedCount = await persistPageCollectionArticles(data);
    return context.json({ message: "Success", persistedCount }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

/** POST /page-collection-existing-urls — global dedup lookup. */
export async function postPageCollectionExistingUrls(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed =
      await postPageCollectionExistingUrlsBodySchema.parseAsync(body);
    const existingUrls = await lookupGlobalExistingUrls(parsed);
    return context.json({ existingUrls }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

/** POST /page-collection/resolve-sources — map listing URLs to curated source rows. */
export async function postPageCollectionResolveSources(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed =
      await postPageCollectionResolveSourcesBodySchema.parseAsync(body);
    const result = await resolveCuratedSourcesByListingUrls(parsed);
    return context.json(result, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

/** GET /page-collection/articles — list collected articles. */
export async function getPageCollectionArticles(
  context: Context,
): Promise<Response> {
  try {
    const query = getPageCollectionArticlesQuerySchema.parse(
      context.req.query(),
    );
    const result = await listPageCollectionArticles(query);
    return context.json(result, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
