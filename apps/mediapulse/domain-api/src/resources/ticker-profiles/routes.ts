import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";

import { parsePagination } from "../../lib/list-pagination";
import { registerTableV1CustomActionRoutes } from "../../hermes-dashboard/templates/table-v1/register-table-v1-custom-actions";
import { mapRowToListItem } from "./list-mapper";
import { tickerProfilesTableV1CustomActionRegistrations } from "./custom-actions";

export const tickerProfilesRoutes = new Hono();

tickerProfilesRoutes.get("/", async (c) => {
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
          { ticker: { symbol: { contains: query, mode: "insensitive" } } },
          { ticker: { name: { contains: query, mode: "insensitive" } } },
          { sectorEnglish: { contains: query, mode: "insensitive" } },
          { subSectorEnglish: { contains: query, mode: "insensitive" } },
          { industryEnglish: { contains: query, mode: "insensitive" } },
        ],
      } satisfies Prisma.TickerProfileWhereInput)
    : undefined;

  const orderBy: Prisma.TickerProfileOrderByWithRelationInput =
    sortBy === "sector"
      ? { sectorEnglish: sortDir }
      : sortBy === "subSector"
        ? { subSectorEnglish: sortDir }
        : sortBy === "industry"
          ? { industryEnglish: sortDir }
          : sortBy === "updatedAt"
            ? { updatedAt: sortDir }
            : { ticker: { symbol: sortDir } };

  const findManyArgs = {
    where,
    skip,
    take: pageSize,
    orderBy,
    include: { ticker: { select: { symbol: true, name: true } } },
  } satisfies Prisma.TickerProfileFindManyArgs;

  const [rows, total] = await Promise.all([
    prisma.tickerProfile.findMany(findManyArgs),
    prisma.tickerProfile.count({ where }),
  ]);

  const payload = tableV1ListResponseSchema.parse({
    items: rows.map(mapRowToListItem),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});

registerTableV1CustomActionRoutes(
  tickerProfilesRoutes,
  tickerProfilesTableV1CustomActionRegistrations,
);

tickerProfilesRoutes.delete("/:id", async (c) => {
  const result = await prisma.tickerProfile.deleteMany({
    where: { id: c.req.param("id") },
  });
  if (result.count < 1) {
    return c.json({ message: "Ticker profile not found" }, 404);
  }

  return c.json({ ok: true });
});
