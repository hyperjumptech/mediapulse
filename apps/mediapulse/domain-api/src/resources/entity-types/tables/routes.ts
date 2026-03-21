import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";
import { parsePagination } from "../../../lib/list-pagination";
import { nullableText } from "../../../lib/nullable-text";
import { mapRowToListItem } from "../hermes-dashboard/templates/table-v1/list-mapper";
import {
  entityTypeCreateSchema,
  entityTypeUpdateSchema,
} from "./request-schemas";

/**
 * Hermes `table-v1` API for knowledge-graph entity type vocabulary.
 */
export const entityTypesRoutes = new Hono();

entityTypesRoutes.get("/", async (c) => {
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
      } satisfies Prisma.EntityTypeWhereInput)
    : undefined;
  const orderBy =
    sortBy === "createdAt" ? { createdAt: sortDir } : { name: sortDir };

  const [rows, total] = await Promise.all([
    prisma.entityType.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
    }),
    prisma.entityType.count({ where }),
  ]);

  const payload = tableV1ListResponseSchema.parse({
    items: rows.map(mapRowToListItem),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});

entityTypesRoutes.post("/", async (c) => {
  const body = entityTypeCreateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  const created = await prisma.entityType.create({
    data: {
      name: body.data.name.trim(),
      description: nullableText(body.data.description),
    },
  });
  return c.json({ id: created.id }, 201);
});

entityTypesRoutes.patch("/:id", async (c) => {
  const body = entityTypeUpdateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  try {
    const updated = await prisma.entityType.update({
      where: { id: c.req.param("id") },
      data: {
        name: body.data.name.trim(),
        description: nullableText(body.data.description),
      },
    });
    return c.json({ id: updated.id });
  } catch {
    return c.json({ message: "Entity type not found" }, 404);
  }
});

entityTypesRoutes.delete("/:id", async (c) => {
  const result = await prisma.entityType.deleteMany({
    where: { id: c.req.param("id") },
  });
  if (result.count < 1) {
    return c.json({ message: "Entity type not found" }, 404);
  }
  return c.json({ ok: true });
});
