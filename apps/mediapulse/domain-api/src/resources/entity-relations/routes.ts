/**
 * HTTP handlers for KG entity relations: paginated list and read-only GET by id (Hermes detail view).
 */

import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";
import { buildMetaPayloadForPathSegment } from "../../hermes-dashboard/templates/table-v1/meta-for-path-segment";
import { parsePagination } from "../../lib/list-pagination";
import {
  listInclude,
  mapRowToDetailItem,
  mapRowToListItem,
} from "./list-mapper";
import { entityRelationsHermesPathSegment } from "./dashboard-page";

/**
 * Maps table-v1 `sortBy` query values to a Prisma `orderBy` for {@link EntityRelation}.
 *
 * @param sortBy - Column key from the dashboard manifest (`sortableFields`).
 * @param sortDir - Ascending or descending.
 */
const resolveEntityRelationListOrderBy = (
  sortBy: string | undefined,
  sortDir: Prisma.SortOrder,
): Prisma.EntityRelationOrderByWithRelationInput => {
  switch (sortBy) {
    case "lastSeenAt":
      return { lastSeenAt: sortDir };
    case "createdAt":
      return { createdAt: sortDir };
    case "weight":
      return { weight: sortDir };
    case "fromEntityName":
      return { fromEntity: { canonicalName: sortDir } };
    case "toEntityName":
      return { toEntity: { canonicalName: sortDir } };
    case "relationTypeName":
      return { relationType: { name: sortDir } };
    default:
      return { lastSeenAt: "desc" };
  }
};

/**
 * Hermes `table-v1` API for entity relations (list + read-only detail).
 */
export const entityRelationsRoutes = new Hono();

/** Paginated list of entity relations for the Hermes dashboard (search `q`; sort `sortBy` / `sortDir`). */
entityRelationsRoutes.get("/", async (c) => {
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
          {
            fromEntity: {
              canonicalName: { contains: query, mode: "insensitive" as const },
            },
          },
          {
            toEntity: {
              canonicalName: { contains: query, mode: "insensitive" as const },
            },
          },
          {
            relationType: {
              name: { contains: query, mode: "insensitive" as const },
            },
          },
        ],
      } satisfies Prisma.EntityRelationWhereInput)
    : undefined;

  const orderBy = resolveEntityRelationListOrderBy(sortBy, sortDir);

  const findManyArgs = {
    where,
    include: listInclude,
    skip,
    take: pageSize,
    orderBy,
  } satisfies Prisma.EntityRelationFindManyArgs;

  const [rows, total] = await Promise.all([
    prisma.entityRelation.findMany(findManyArgs),
    prisma.entityRelation.count({ where }),
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
entityRelationsRoutes.get("/meta", (c) => {
  const meta = buildMetaPayloadForPathSegment(entityRelationsHermesPathSegment);
  if (!meta) {
    return c.json({ message: "Unknown dashboard resource" }, 404);
  }
  return c.json(meta);
});

/** Returns one entity relation by id for the Hermes read-only detail page. */
entityRelationsRoutes.get("/:id", async (c) => {
  const row = await prisma.entityRelation.findUnique({
    where: { id: c.req.param("id") },
    include: listInclude,
  } satisfies Prisma.EntityRelationFindUniqueArgs);

  if (!row) {
    return c.json({ message: "Entity relation not found" }, 404);
  }

  return c.json(mapRowToDetailItem(row));
});
