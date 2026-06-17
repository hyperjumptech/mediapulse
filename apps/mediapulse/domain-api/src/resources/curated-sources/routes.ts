/**
 * HTTP handlers for the curated-sources Hermes dashboard resource: paginated list, detail, create, update, and delete.
 */

import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";
import type { z } from "zod";
import { buildMetaPayloadForPathSegment } from "../../hermes-dashboard/templates/table-v1/meta-for-path-segment";
import { parseCreatedDateBound } from "../../lib/parse-created-date-bound";
import { parsePagination } from "../../lib/list-pagination";
import { nullableText } from "../../lib/nullable-text";
import { curatedSourcesHermesPathSegment } from "./dashboard-page";
import { mapRowToDetailItem } from "./detail-mapper";
import {
  buildCuratedSourceListOrderBy,
  buildCuratedSourceListWhere,
  type CuratedSourceListSortField,
} from "./list-filters";
import { mapRowToListItem } from "./list-mapper";
import {
  curatedSourceCreateBodySchema,
  curatedSourceUpdateBodySchema,
} from "./write-body-schemas";

/**
 * Parses table-v1 `sortBy` query values for curated sources.
 *
 * @param raw - Raw `sortBy` query parameter.
 * @returns A supported sort field, or `undefined` to use the default.
 */
const parseSortBy = (
  raw: string | undefined,
): CuratedSourceListSortField | undefined => {
  if (raw === "name") return "name";
  if (raw === "listingUrl") return "listingUrl";
  if (raw === "enabled") return "enabled";
  if (raw === "maxItems") return "maxItems";
  if (raw === "createdAt") return "createdAt";
  return undefined;
};

/**
 * Parses the optional enabled boolean filter from the query string.
 *
 * @param raw - Raw `enabled` query parameter.
 * @returns `true`, `false`, or `undefined` when unset or invalid.
 */
const parseEnabledFilter = (raw: string | undefined): boolean | undefined => {
  const trimmed = raw?.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  return undefined;
};

/**
 * Maps validated write-body fields to Prisma create/update data.
 *
 * @param body - Parsed create or update body.
 * @returns Prisma scalar fields for curated sources.
 */
const toCuratedSourceWriteData = (
  body: z.infer<typeof curatedSourceCreateBodySchema>,
) => ({
  name: nullableText(body.name),
  listingUrl: body.listingUrl.trim(),
  enabled: body.enabled,
  maxItems: body.maxItems ?? null,
});

/**
 * Hermes `table-v1` API for operator-managed page-collection listing URLs.
 */
export const curatedSourcesRoutes = new Hono();

/** Paginated list of curated sources (search `q`, filters, `sortBy`, `sortDir`). */
curatedSourcesRoutes.get("/", async (c) => {
  const { page, pageSize } = parsePagination(
    c.req.query("page"),
    c.req.query("pageSize"),
  );
  const skip = (page - 1) * pageSize;

  const where = buildCuratedSourceListWhere({
    q: c.req.query("q"),
    enabled: parseEnabledFilter(c.req.query("enabled")),
    from: parseCreatedDateBound(c.req.query("from"), "start"),
    to: parseCreatedDateBound(c.req.query("to"), "end"),
  });

  const orderBy = buildCuratedSourceListOrderBy(
    parseSortBy(c.req.query("sortBy")),
    c.req.query("sortDir") === "asc" ? "asc" : "desc",
  );

  const findManyArgs = {
    where,
    skip,
    take: pageSize,
    orderBy,
  } satisfies Prisma.CuratedSourceFindManyArgs;

  const [rows, total] = await Promise.all([
    prisma.curatedSource.findMany(findManyArgs),
    prisma.curatedSource.count({ where }),
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
 * Table-v1 metadata for Hermes. Registered before `GET /:id` so `/meta` is not captured as an id.
 */
curatedSourcesRoutes.get("/meta", (c) => {
  const meta = buildMetaPayloadForPathSegment(curatedSourcesHermesPathSegment);
  if (!meta) {
    return c.json({ message: "Unknown dashboard resource" }, 404);
  }
  return c.json(meta);
});

/** Returns one curated source by id for Hermes detail and edit views. */
curatedSourcesRoutes.get("/:id", async (c) => {
  const findUniqueArgs = {
    where: { id: c.req.param("id") },
  } satisfies Prisma.CuratedSourceFindUniqueArgs;

  const row = await prisma.curatedSource.findUnique(findUniqueArgs);
  if (!row) {
    return c.json({ message: "Curated source not found" }, 404);
  }

  return c.json(mapRowToDetailItem(row));
});

/** Creates a curated source from the Hermes create form. */
curatedSourcesRoutes.post("/", async (c) => {
  const body = curatedSourceCreateBodySchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  try {
    const created = await prisma.curatedSource.create({
      data: toCuratedSourceWriteData(body.data),
    });
    return c.json({ id: created.id }, 201);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return c.json({ message: "Listing URL already exists" }, 409);
    }
    throw error;
  }
});

/** Updates a curated source by id. */
curatedSourcesRoutes.patch("/:id", async (c) => {
  const body = curatedSourceUpdateBodySchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  try {
    const updated = await prisma.curatedSource.update({
      where: { id: c.req.param("id") },
      data: toCuratedSourceWriteData(body.data),
    });
    return c.json({ id: updated.id });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return c.json({ message: "Curated source not found" }, 404);
      }
      if (error.code === "P2002") {
        return c.json({ message: "Listing URL already exists" }, 409);
      }
    }
    throw error;
  }
});

/** Deletes a curated source by id. */
curatedSourcesRoutes.delete("/:id", async (c) => {
  const result = await prisma.curatedSource.deleteMany({
    where: { id: c.req.param("id") },
  });
  if (result.count < 1) {
    return c.json({ message: "Curated source not found" }, 404);
  }
  return c.json({ ok: true });
});
