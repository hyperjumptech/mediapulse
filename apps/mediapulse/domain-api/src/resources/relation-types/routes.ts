/**
 * HTTP handlers for the relation-types Hermes resource: list, create, update, delete.
 */

import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";
import { parsePagination } from "../../lib/list-pagination";
import { nullableText } from "../../lib/nullable-text";
import { mapRowToListItem } from "./list-mapper";
import {
  relationTypeCreateSchema,
  relationTypeUpdateSchema,
} from "./request-schemas";

/**
 * Hermes `table-v1` API for knowledge-graph relation type vocabulary.
 */
export const relationTypesRoutes = new Hono();

/** Paginated list of relation types for the Hermes dashboard table (search `q`, `sortBy`, `sortDir`). */
relationTypesRoutes.get("/", async (c) => {
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
        ],
      } satisfies Prisma.RelationTypeWhereInput)
    : undefined;
  const orderBy =
    sortBy === "createdAt" ? { createdAt: sortDir } : { name: sortDir };

  const [rows, total] = await Promise.all([
    prisma.relationType.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
    }),
    prisma.relationType.count({ where }),
  ]);

  const payload = tableV1ListResponseSchema.parse({
    items: rows.map(mapRowToListItem),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});

/** Creates a new knowledge-graph relation type row from the table create form. */
relationTypesRoutes.post("/", async (c) => {
  const body = relationTypeCreateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  const created = await prisma.relationType.create({
    data: {
      name: body.data.name.trim(),
      description: nullableText(body.data.description),
    },
  });
  return c.json({ id: created.id }, 201);
});

/** Updates a relation type by id (Hermes table edit / PATCH body matches update schema). */
relationTypesRoutes.patch("/:id", async (c) => {
  const body = relationTypeUpdateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  try {
    const updated = await prisma.relationType.update({
      where: { id: c.req.param("id") },
      data: {
        name: body.data.name.trim(),
        description: nullableText(body.data.description),
      },
    });
    return c.json({ id: updated.id });
  } catch {
    return c.json({ message: "Relation type not found" }, 404);
  }
});

/** Deletes a relation type by id (Hermes table row delete). */
relationTypesRoutes.delete("/:id", async (c) => {
  const result = await prisma.relationType.deleteMany({
    where: { id: c.req.param("id") },
  });
  if (result.count < 1) {
    return c.json({ message: "Relation type not found" }, 404);
  }
  return c.json({ ok: true });
});
