/**
 * HTTP handlers for `db:` expansion aliases: table meta, list, single-row fetch, create, update, delete.
 */

import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";
import { dataSourceExpansionsHermesPathSegment } from "./dashboard-page";
import { buildMetaPayloadForPathSegment } from "../../hermes-dashboard/templates/table-v1/meta-for-path-segment";
import { parsePagination } from "../../lib/list-pagination";
import { nullableText } from "../../lib/nullable-text";
import { mapRowToListItem } from "./list-mapper";
import {
  dataSourceExpansionCreateSchema,
  dataSourceExpansionUpdateSchema,
} from "./request-schemas";

/**
 * Hermes `table-v1` API for reusable `db:` data-source expansion aliases.
 */
export const dataSourceExpansionsRoutes = new Hono();

/**
 * Returns `table-v1` column and form metadata for this resource.
 * Mounted here (before `/:id`) so `meta` is not treated as an expansion id.
 */
dataSourceExpansionsRoutes.get("/meta", (c) => {
  const meta = buildMetaPayloadForPathSegment(
    dataSourceExpansionsHermesPathSegment,
  );
  if (!meta) {
    return c.json({ message: "Unknown dashboard resource" }, 404);
  }
  return c.json(meta);
});

/** Paginated list of `db:` expansion aliases for the Hermes dashboard table (search `q`, `sortBy`, `sortDir`). */
dataSourceExpansionsRoutes.get("/", async (c) => {
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
          { name: { contains: query, mode: "insensitive" as const } },
          { description: { contains: query, mode: "insensitive" as const } },
          {
            expansionString: {
              contains: query,
              mode: "insensitive" as const,
            },
          },
        ],
      } satisfies Prisma.DataSourceExpansionWhereInput)
    : undefined;
  const orderBy =
    sortBy === "createdAt" ? { createdAt: sortDir } : { name: sortDir };

  const [rows, total] = await Promise.all([
    prisma.dataSourceExpansion.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
    }),
    prisma.dataSourceExpansion.count({ where }),
  ]);

  const payload = tableV1ListResponseSchema.parse({
    items: rows.map(mapRowToListItem),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});

/** Loads one expansion by id for the full-page create/edit flow (all scalar fields). */
dataSourceExpansionsRoutes.get("/:id", async (c) => {
  const row = await prisma.dataSourceExpansion.findUnique({
    where: { id: c.req.param("id") },
  });
  if (!row) {
    return c.json({ message: "Data source expansion not found" }, 404);
  }
  return c.json({
    id: row.id,
    name: row.name,
    expansionString: row.expansionString,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
});

/** Creates a new data-source expansion alias from the table create form. */
dataSourceExpansionsRoutes.post("/", async (c) => {
  const body = dataSourceExpansionCreateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  const created = await prisma.dataSourceExpansion.create({
    data: {
      name: body.data.name.trim(),
      expansionString: body.data.expansionString.trim(),
      description: nullableText(body.data.description),
      createdById: "00000000-0000-0000-0000-000000000000",
    },
  });
  return c.json({ id: created.id }, 201);
});

/** Updates a data-source expansion by id (Hermes full-page or modal edit). */
dataSourceExpansionsRoutes.patch("/:id", async (c) => {
  const body = dataSourceExpansionUpdateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  try {
    const updated = await prisma.dataSourceExpansion.update({
      where: { id: c.req.param("id") },
      data: {
        name: body.data.name.trim(),
        expansionString: body.data.expansionString.trim(),
        description: nullableText(body.data.description),
      },
    });
    return c.json({ id: updated.id });
  } catch {
    return c.json({ message: "Data source expansion not found" }, 404);
  }
});

/** Deletes a data-source expansion by id (Hermes table row delete). */
dataSourceExpansionsRoutes.delete("/:id", async (c) => {
  const result = await prisma.dataSourceExpansion.deleteMany({
    where: { id: c.req.param("id") },
  });
  if (result.count < 1) {
    return c.json({ message: "Data source expansion not found" }, 404);
  }
  return c.json({ ok: true });
});
