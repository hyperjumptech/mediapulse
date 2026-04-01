/**
 * HTTP handlers for stored search queries: paginated list and delete-by-id (no create/update).
 */

import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";
import { parsePagination } from "../../lib/list-pagination";
import { listInclude, mapRowToListItem } from "./list-mapper";

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
  const query = c.req.query("q")?.trim();
  const skip = (page - 1) * pageSize;

  const where = query
    ? ({
        OR: [
          { text: { contains: query, mode: "insensitive" as const } },
          {
            ticker: { name: { contains: query, mode: "insensitive" as const } },
          },
          {
            ticker: {
              symbol: { contains: query, mode: "insensitive" as const },
            },
          },
          {
            set: {
              is: { id: { contains: query, mode: "insensitive" as const } },
            },
          },
          {
            set: {
              is: {
                agentJobId: { contains: query, mode: "insensitive" as const },
              },
            },
          },
        ],
      } satisfies Prisma.SearchQueryWhereInput)
    : undefined;

  const [rows, total] = await Promise.all([
    prisma.searchQuery.findMany({
      where,
      include: listInclude,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    } satisfies Prisma.SearchQueryFindManyArgs),
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
