import { Context } from "hono";

import {
  dataCollectionBodySchema,
  dataCollectionQuerySchema,
} from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";
import { canonicalizeUrl } from "@workspace/utils";
import { prisma } from "@mediapulse/database";

import { insertDataSourcesIdempotently } from "../services/insert-data-sources-idempotently.js";
import { aggregateSearchQueryYieldForTicker } from "../services/search-query-yield.js";

export async function getDataCollection(context: Context): Promise<Response> {
  try {
    const query = dataCollectionQuerySchema.parse(context.req.query());
    const data = await prisma.searchQuery.findMany({
      where: {
        tickerId: query.tickerId,
        set: {
          isActive: true,
        },
        ...(query.start &&
          query.end && {
            createdAt: {
              gte: new Date(query.start),
              lte: new Date(query.end),
            },
          }),
      },
      select: {
        id: true,
        text: true,
        tickerId: true,
        intent: true,
        rank: true,
      },
      orderBy: { rank: "asc" },
    });

    return context.json({ data }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postDataCollection(context: Context): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await dataCollectionBodySchema.parseAsync(body);
    await insertDataSourcesIdempotently(
      data.map((row) => {
        let canonicalUrl: string;
        try {
          canonicalUrl = canonicalizeUrl(row.url);
        } catch {
          canonicalUrl = row.url;
        }
        return {
          ...row,
          canonicalUrl,
          description: row.description ?? null,
          content: row.content ?? null,
          ...(row.publishedAt
            ? { publishedAt: new Date(row.publishedAt) }
            : {}),
        };
      }),
      { dataSource: prisma.dataSource },
    );

    const tickerIds = [...new Set(data.map((row) => row.tickerId))];
    await Promise.all(
      tickerIds.map((tickerId) =>
        aggregateSearchQueryYieldForTicker({ tickerId }),
      ),
    );

    return context.json({ message: "Success" }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
