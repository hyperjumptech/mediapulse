/**
 * HTTP handlers for canonical KG entities: paginated list and read-only GET by id (Hermes detail view).
 */

import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";
import { z } from "zod";
import { buildMetaPayloadForPathSegment } from "../../hermes-dashboard/templates/table-v1/meta-for-path-segment";
import { registerTableV1CustomActionRoutes } from "../../hermes-dashboard/templates/table-v1/register-table-v1-custom-actions";
import { parseCreatedDateBound } from "../../lib/parse-created-date-bound";
import { parsePagination } from "../../lib/list-pagination";
import { entitiesTableV1CustomActionRegistrations } from "./custom-actions";
import { detailInclude, mapRowToDetailItem } from "./detail-mapper";
import { buildEntityListWhere } from "./list-filters";
import { listInclude, mapRowToListItem } from "./list-mapper";
import { entitiesHermesPathSegment } from "./dashboard-page";

/**
 * Maps table-v1 `sortBy` query values to a Prisma `orderBy` for {@link Entity}.
 *
 * @param sortBy - Column key from the dashboard manifest (`sortableFields`).
 * @param sortDir - Ascending or descending.
 */
const resolveEntityListOrderBy = (
  sortBy: string | undefined,
  sortDir: Prisma.SortOrder,
): Prisma.EntityOrderByWithRelationInput => {
  switch (sortBy) {
    case "canonicalName":
      return { canonicalName: sortDir };
    case "createdAt":
      return { createdAt: sortDir };
    case "entityTypeName":
      return { type: { name: sortDir } };
    default:
      return { createdAt: "desc" };
  }
};

/**
 * Hermes `table-v1` API for knowledge-graph entities (list + read-only detail).
 */
export const entitiesRoutes = new Hono();

/** Paginated list of entities for the Hermes dashboard (search, filters, sort). */
entitiesRoutes.get("/", async (c) => {
  const { page, pageSize } = parsePagination(
    c.req.query("page"),
    c.req.query("pageSize"),
  );
  const sortBy = c.req.query("sortBy");
  const sortDir: Prisma.SortOrder =
    c.req.query("sortDir") === "desc" ? "desc" : "asc";
  const skip = (page - 1) * pageSize;

  const tickerFilter = z
    .string()
    .uuid()
    .safeParse(c.req.query("tickerId")?.trim() ?? "");
  const typeFilter = z
    .string()
    .uuid()
    .safeParse(c.req.query("typeId")?.trim() ?? "");

  const where = buildEntityListWhere({
    q: c.req.query("q"),
    tickerId: tickerFilter.success ? tickerFilter.data : undefined,
    typeId: typeFilter.success ? typeFilter.data : undefined,
    from: parseCreatedDateBound(c.req.query("from"), "start"),
    to: parseCreatedDateBound(c.req.query("to"), "end"),
  });

  const orderBy = resolveEntityListOrderBy(sortBy, sortDir);

  const findManyArgs = {
    where,
    include: listInclude,
    skip,
    take: pageSize,
    orderBy,
  } satisfies Prisma.EntityFindManyArgs;

  const [rows, total] = await Promise.all([
    prisma.entity.findMany(findManyArgs),
    prisma.entity.count({ where }),
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
 * Table-v1 metadata for Hermes. Registered **before** `GET /:id` so `/meta` is not captured as an id
 * (see {@link buildMetaPayloadForPathSegment}).
 */
entitiesRoutes.get("/meta", async (c) => {
  const base = buildMetaPayloadForPathSegment(entitiesHermesPathSegment);
  if (!base) {
    return c.json({ message: "Unknown dashboard resource" }, 404);
  }

  const [tickerOptions, entityTypeOptions] = await Promise.all([
    prisma.ticker.findMany({
      select: { id: true, symbol: true, name: true },
      orderBy: { symbol: "asc" },
    } satisfies Prisma.TickerFindManyArgs),
    prisma.entityType.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    } satisfies Prisma.EntityTypeFindManyArgs),
  ]);

  return c.json({
    ...base,
    tickerOptions: tickerOptions.map((ticker) => ({
      value: ticker.id,
      label: `${ticker.symbol} — ${ticker.name}`,
    })),
    entityTypeOptions: entityTypeOptions.map((entityType) => ({
      value: entityType.id,
      label: entityType.name,
    })),
  });
});

/** Returns one entity by id for the Hermes read-only detail page. */
entitiesRoutes.get("/:id", async (c) => {
  const row = await prisma.entity.findUnique({
    where: { id: c.req.param("id") },
    include: detailInclude,
  } satisfies Prisma.EntityFindUniqueArgs);

  if (!row) {
    return c.json({ message: "Entity not found" }, 404);
  }

  return c.json(mapRowToDetailItem(row));
});

registerTableV1CustomActionRoutes(
  entitiesRoutes,
  entitiesTableV1CustomActionRegistrations,
);
