/**
 * HTTP handlers for tickers: list, create, update, delete, plus manifest-driven custom actions (IDX import).
 */

import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";
import { parsePagination } from "../../lib/list-pagination";
import { registerTableV1CustomActionRoutes } from "../../hermes-dashboard/templates/table-v1/register-table-v1-custom-actions";
import { mergeTickerMetadataForPatch } from "./lib/merge-metadata";
import { parseTickerMetadataJson } from "./lib/parse-metadata-json";
import { mapRowToListItem } from "./list-mapper";
import {
  tickerCreateBodySchema,
  tickerUpdateBodySchema,
} from "./write-body-schemas";
import { tickersTableV1CustomActionRegistrations } from "./custom-actions";

/**
 * Hermes `table-v1` API for tickers plus IDX JSON import.
 */
export const tickersRoutes = new Hono();

/** Paginated list of tickers for the Hermes dashboard table (search `q`, `sortBy`, `sortDir`). */
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

/** Creates a ticker (symbol, name, optional metadata JSON) from the table create form. */
tickersRoutes.post("/", async (c) => {
  const body = tickerCreateBodySchema.safeParse(await c.req.json());
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

/** Registers manifest-driven custom POST routes (e.g. IDX JSON bulk import). */
registerTableV1CustomActionRoutes(
  tickersRoutes,
  tickersTableV1CustomActionRegistrations,
);

/** Updates a ticker by id, including optional metadata merge semantics on PATCH. */
tickersRoutes.patch("/:id", async (c) => {
  const body = tickerUpdateBodySchema.safeParse(await c.req.json());
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

/** Deletes a ticker by id (Hermes table row delete). */
tickersRoutes.delete("/:id", async (c) => {
  const result = await prisma.ticker.deleteMany({
    where: { id: c.req.param("id") },
  });
  if (result.count < 1) {
    return c.json({ message: "Ticker not found" }, 404);
  }
  return c.json({ ok: true });
});
