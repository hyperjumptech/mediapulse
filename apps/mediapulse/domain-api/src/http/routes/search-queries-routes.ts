import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";
import { parsePagination } from "../../lib/list-pagination";

/**
 * Hermes `table-v1` API for generated search queries (list + delete only).
 */
export const searchQueriesRoutes = new Hono();

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
        ],
      } satisfies Prisma.SearchQueryWhereInput)
    : undefined;

  const [rows, total] = await Promise.all([
    prisma.searchQuery.findMany({
      where,
      include: {
        ticker: {
          select: {
            symbol: true,
            name: true,
          },
        },
      },
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    } satisfies Prisma.SearchQueryFindManyArgs),
    prisma.searchQuery.count({ where }),
  ]);

  const payload = tableV1ListResponseSchema.parse({
    items: rows.map((row) => ({
      id: row.id,
      text: row.text,
      tickerSymbol: row.ticker.symbol,
      tickerName: row.ticker.name,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});

searchQueriesRoutes.delete("/:id", async (c) => {
  const result = await prisma.searchQuery.deleteMany({
    where: { id: c.req.param("id") },
  });
  if (result.count < 1) {
    return c.json({ message: "Search query not found" }, 404);
  }
  return c.json({ ok: true });
});
