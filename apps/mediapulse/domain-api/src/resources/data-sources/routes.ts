/**
 * HTTP handlers for collected data sources: paginated list and read-only GET by id (Hermes detail view).
 */

import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";
import { buildMetaPayloadForPathSegment } from "../../hermes-dashboard/templates/table-v1/meta-for-path-segment";
import { registerTableV1CustomActionRoutes } from "../../hermes-dashboard/templates/table-v1/register-table-v1-custom-actions";
import { parsePagination } from "../../lib/list-pagination";
import { dataSourcesTableV1CustomActionRegistrations } from "./custom-actions";
import {
  listInclude,
  mapRowToDetailItem,
  mapRowToListItem,
} from "./list-mapper";

/** Manifest `pathSegment` for this resource (must match the data-sources page in the Hermes dashboard manifest). */
const DATA_SOURCES_PATH_SEGMENT = "data-sources" as const;

/**
 * Maps table-v1 `sortBy` query values to a Prisma `orderBy` for {@link DataSource}.
 *
 * @param sortBy - Column key from the dashboard manifest (`sortableFields`).
 * @param sortDir - Ascending or descending.
 */
const resolveDataSourceListOrderBy = (
  sortBy: string | undefined,
  sortDir: Prisma.SortOrder,
): Prisma.DataSourceOrderByWithRelationInput => {
  switch (sortBy) {
    case "createdAt":
      return { createdAt: sortDir };
    case "title":
      return { title: sortDir };
    case "url":
      return { url: sortDir };
    case "tickerSymbol":
      return { ticker: { symbol: sortDir } };
    case "searchQueryText":
      return { searchQuery: { text: sortDir } };
    default:
      return { createdAt: "desc" };
  }
};

/**
 * Hermes `table-v1` API for collected article/data sources (list + read-only detail).
 */
export const dataSourcesRoutes = new Hono();

/** Paginated list of data sources for the Hermes dashboard (search `q`; sort `sortBy` / `sortDir`). */
dataSourcesRoutes.get("/", async (c) => {
  const { page, pageSize } = parsePagination(
    c.req.query("page"),
    c.req.query("pageSize"),
  );
  const query = c.req.query("q")?.trim();
  const sortBy = c.req.query("sortBy");
  const sortDir: Prisma.SortOrder =
    c.req.query("sortDir") === "desc" ? "desc" : "asc";
  const skip = (page - 1) * pageSize;

  const where = query
    ? ({
        OR: [
          { title: { contains: query, mode: "insensitive" as const } },
          { url: { contains: query, mode: "insensitive" as const } },
          { content: { contains: query, mode: "insensitive" as const } },
          {
            ticker: {
              symbol: { contains: query, mode: "insensitive" as const },
            },
          },
          {
            ticker: { name: { contains: query, mode: "insensitive" as const } },
          },
          {
            searchQuery: {
              text: { contains: query, mode: "insensitive" as const },
            },
          },
        ],
      } satisfies Prisma.DataSourceWhereInput)
    : undefined;

  const orderBy = resolveDataSourceListOrderBy(sortBy, sortDir);

  const findManyArgs = {
    where,
    include: listInclude,
    skip,
    take: pageSize,
    orderBy,
  } satisfies Prisma.DataSourceFindManyArgs;

  const [rows, total] = await Promise.all([
    prisma.dataSource.findMany(findManyArgs),
    prisma.dataSource.count({ where }),
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
dataSourcesRoutes.get("/meta", (c) => {
  const meta = buildMetaPayloadForPathSegment(DATA_SOURCES_PATH_SEGMENT);
  if (!meta) {
    return c.json({ message: "Unknown dashboard resource" }, 404);
  }
  return c.json(meta);
});

/** Returns one data source by id (full `content`) for the Hermes read-only detail page. */
dataSourcesRoutes.get("/:id", async (c) => {
  const row = await prisma.dataSource.findUnique({
    where: { id: c.req.param("id") },
    include: listInclude,
  } satisfies Prisma.DataSourceFindUniqueArgs);

  if (!row) {
    return c.json({ message: "Data source not found" }, 404);
  }

  return c.json(mapRowToDetailItem(row));
});

registerTableV1CustomActionRoutes(
  dataSourcesRoutes,
  dataSourcesTableV1CustomActionRegistrations,
);
