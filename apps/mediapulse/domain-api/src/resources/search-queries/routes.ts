/**
 * HTTP handlers for stored search queries: paginated list and delete-by-id (no create/update).
 */

import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { queryAnalysisIntentSchema } from "@workspace/agent-data-api-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";
import { z } from "zod";

import { buildMetaPayloadForPathSegment } from "../../hermes-dashboard/templates/table-v1/meta-for-path-segment";
import { registerTableV1CustomActionRoutes } from "../../hermes-dashboard/templates/table-v1/register-table-v1-custom-actions";
import { parseCreatedDateBound } from "../../lib/parse-created-date-bound";
import { parsePagination } from "../../lib/list-pagination";
import { searchQueriesTableV1CustomActionRegistrations } from "./custom-actions";
import { searchQueriesHermesPathSegment } from "./dashboard-page";
import { buildSearchQueryListWhere } from "./list-filters";
import { listInclude, mapRowToListItem } from "./list-mapper";

/**
 * Formats a Prisma enum value for dropdown labels (underscores to spaces).
 *
 * @param value - Raw enum string.
 * @returns Human-readable label for filter dropdowns.
 */
export const formatSearchQueryEnumLabel = (value: string): string =>
  value.replace(/_/g, " ");

/**
 * Hermes `table-v1` API for generated search queries (list + delete only).
 */
export const searchQueriesRoutes = new Hono();

/** Paginated list of generated search queries for the Hermes dashboard table (search `q`; newest first). */
searchQueriesRoutes.get("/", async (c) => {
  const { page, pageSize } = parsePagination(
    c.req.query("page"),
    c.req.query("pageSize"),
  );
  const skip = (page - 1) * pageSize;

  const tickerFilter = z
    .string()
    .uuid()
    .safeParse(c.req.query("tickerId")?.trim() ?? "");
  const intentFilter = queryAnalysisIntentSchema.safeParse(
    c.req.query("intent")?.trim() ?? "",
  );
  const isActiveRaw = c.req.query("isActive")?.trim() ?? "";
  const isActiveFilter = z
    .enum(["true", "false"])
    .safeParse(isActiveRaw.length > 0 ? isActiveRaw : undefined);

  const where = buildSearchQueryListWhere({
    q: c.req.query("q"),
    tickerId: tickerFilter.success ? tickerFilter.data : undefined,
    intent: intentFilter.success ? intentFilter.data : undefined,
    isActive: isActiveFilter.success
      ? isActiveFilter.data === "true"
      : undefined,
    from: parseCreatedDateBound(c.req.query("from"), "start"),
    to: parseCreatedDateBound(c.req.query("to"), "end"),
  });

  const findManyArgs = {
    where,
    include: listInclude,
    skip,
    take: pageSize,
    orderBy: { createdAt: "desc" },
  } satisfies Prisma.SearchQueryFindManyArgs;

  const [rows, total] = await Promise.all([
    prisma.searchQuery.findMany(findManyArgs),
    prisma.searchQuery.count({ where }),
  ]);

  const payload = tableV1ListResponseSchema.parse({
    items: rows.map(mapRowToListItem),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});

/**
 * Table-v1 metadata for Hermes. Registered **before** `DELETE /:id` so `/meta` is not captured as an id.
 */
searchQueriesRoutes.get("/meta", async (c) => {
  const base = buildMetaPayloadForPathSegment(searchQueriesHermesPathSegment);
  if (!base) {
    return c.json({ message: "Unknown dashboard resource" }, 404);
  }

  const [tickerOptions, intentRows] = await Promise.all([
    prisma.ticker.findMany({
      select: { id: true, symbol: true, name: true },
      orderBy: { symbol: "asc" },
    } satisfies Prisma.TickerFindManyArgs),
    prisma.searchQuery.findMany({
      distinct: ["intent"],
      select: { intent: true },
      orderBy: { intent: "asc" },
    } satisfies Prisma.SearchQueryFindManyArgs),
  ]);

  return c.json({
    ...base,
    filterOptions: {
      tickerOptions: tickerOptions.map((ticker) => ({
        value: ticker.id,
        label: `${ticker.symbol} — ${ticker.name}`,
      })),
      intentOptions: intentRows.map((row) => ({
        value: row.intent,
        label: formatSearchQueryEnumLabel(row.intent),
      })),
    },
  });
});

/** Deletes a stored search query by id (this resource has no create/update in Hermes). */
searchQueriesRoutes.delete("/:id", async (c) => {
  const result = await prisma.searchQuery.deleteMany({
    where: { id: c.req.param("id") },
  });
  if (result.count < 1) {
    return c.json({ message: "Search query not found" }, 404);
  }
  return c.json({ ok: true });
});

registerTableV1CustomActionRoutes(
  searchQueriesRoutes,
  searchQueriesTableV1CustomActionRegistrations,
);
