import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";
import { importIdxTickersFromRequestBody } from "../../lib/import-idx-tickers-json";
import { parsePagination } from "../../lib/list-pagination";
import { mergeTickerMetadataForPatch } from "../../lib/merge-ticker-metadata";
import { parseTickerMetadataJson } from "../../lib/parse-ticker-metadata-json";
import {
  tickerCreateSchema,
  tickerUpdateSchema,
} from "../../lib/request-body-schemas";

/**
 * Hermes `table-v1` API for tickers plus IDX JSON import.
 */
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
    items: rows.map((row) => ({
      id: row.id,
      symbol: row.symbol,
      name: row.name,
      metadata:
        row.metadata === null || row.metadata === undefined
          ? ""
          : JSON.stringify(row.metadata, null, 2),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});

tickersRoutes.post("/", async (c) => {
  const body = tickerCreateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  const metadataParsed = parseTickerMetadataJson(body.data.metadata);
  if (!metadataParsed.ok) {
    return c.json({ message: metadataParsed.message }, 400);
  }

  const created = await prisma.ticker.create({
    data: {
      symbol: body.data.symbol.trim(),
      name: body.data.name.trim(),
      ...(metadataParsed.value !== undefined
        ? {
            metadata:
              metadataParsed.value === null
                ? Prisma.DbNull
                : metadataParsed.value,
          }
        : {}),
    },
  });
  return c.json({ id: created.id }, 201);
});

tickersRoutes.post("/import-idx-json", async (c) => {
  let jsonBody: unknown;
  try {
    jsonBody = await c.req.json();
  } catch {
    return c.json({ message: "Invalid JSON" }, 400);
  }

  const result = await importIdxTickersFromRequestBody(jsonBody);
  if (!result.ok) {
    return c.json({ message: result.message }, result.status);
  }

  return c.json({ added: result.added, updated: result.updated });
});

tickersRoutes.patch("/:id", async (c) => {
  const body = tickerUpdateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  const metadataParsed = parseTickerMetadataJson(body.data.metadata);
  if (!metadataParsed.ok) {
    return c.json({ message: metadataParsed.message }, 400);
  }

  const existing = await prisma.ticker.findUnique({
    where: { id: c.req.param("id") },
    select: { id: true, metadata: true },
  });
  if (!existing) {
    return c.json({ message: "Ticker not found" }, 404);
  }

  const mergedMetadata = mergeTickerMetadataForPatch(
    existing.metadata,
    metadataParsed.ok ? metadataParsed.value : undefined,
  );

  const updated = await prisma.ticker.update({
    where: { id: c.req.param("id") },
    data: {
      symbol: body.data.symbol.trim(),
      name: body.data.name.trim(),
      ...(mergedMetadata !== undefined ? { metadata: mergedMetadata } : {}),
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
