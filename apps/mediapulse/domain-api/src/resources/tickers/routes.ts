import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, type Prisma } from "@mediapulse/database";
import { Hono } from "hono";

import { registerTableV1CustomActionRoutes } from "../../hermes-dashboard/templates/table-v1/register-table-v1-custom-actions";
import { parsePagination } from "../../lib/list-pagination";
import { tickersTableV1CustomActionRegistrations } from "./custom-actions";
import { mapRowToListItem } from "./list-mapper";
import {
  tickerCreateBodySchema,
  tickerUpdateBodySchema,
} from "./write-body-schemas";

export const tickersRoutes = new Hono();

tickersRoutes.get("/", async (c) => {
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
          { symbol: { contains: query, mode: "insensitive" as const } },
          { name: { contains: query, mode: "insensitive" as const } },
        ],
      } satisfies Prisma.TickerWhereInput)
    : undefined;
  const orderBy =
    sortBy === "name"
      ? { name: sortDir }
      : sortBy === "createdAt"
        ? { createdAt: sortDir }
        : { symbol: sortDir };

  const findManyArgs = {
    where,
    skip,
    take: pageSize,
    orderBy,
  } satisfies Prisma.TickerFindManyArgs;

  const [rows, total] = await Promise.all([
    prisma.ticker.findMany(findManyArgs),
    prisma.ticker.count({ where }),
  ]);

  const payload = tableV1ListResponseSchema.parse({
    items: rows.map(mapRowToListItem),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});

tickersRoutes.post("/", async (c) => {
  const body = tickerCreateBodySchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  const created = await prisma.ticker.create({
    data: {
      symbol: body.data.symbol.trim(),
      name: body.data.name.trim(),
    },
  });

  return c.json({ id: created.id }, 201);
});

registerTableV1CustomActionRoutes(
  tickersRoutes,
  tickersTableV1CustomActionRegistrations,
);

tickersRoutes.patch("/:id", async (c) => {
  const body = tickerUpdateBodySchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  const existing = await prisma.ticker.findUnique({
    where: { id: c.req.param("id") },
    select: { id: true },
  });
  if (!existing) {
    return c.json({ message: "Ticker not found" }, 404);
  }

  const updated = await prisma.ticker.update({
    where: { id: c.req.param("id") },
    data: {
      symbol: body.data.symbol.trim(),
      name: body.data.name.trim(),
    },
  });

  return c.json({ id: updated.id });
});

tickersRoutes.delete("/:id", async (c) => {
  const result = await prisma.ticker.deleteMany({
    where: { id: c.req.param("id") },
  });
  if (result.count < 1) {
    return c.json({ message: "Ticker not found" }, 404);
  }

  return c.json({ ok: true });
});
