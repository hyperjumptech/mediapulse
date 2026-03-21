import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";
import { parsePagination } from "../../lib/list-pagination";
import { nullableText } from "../../lib/nullable-text";
import {
  relationTypeCreateSchema,
  relationTypeUpdateSchema,
} from "../../lib/request-body-schemas";

/**
 * Hermes `table-v1` API for knowledge-graph relation type vocabulary.
 */
export const relationTypesRoutes = new Hono();

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
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});

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

relationTypesRoutes.delete("/:id", async (c) => {
  const result = await prisma.relationType.deleteMany({
    where: { id: c.req.param("id") },
  });
  if (result.count < 1) {
    return c.json({ message: "Relation type not found" }, 404);
  }
  return c.json({ ok: true });
});
