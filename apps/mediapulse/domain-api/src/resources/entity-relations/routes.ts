/**
 * HTTP handlers for KG entity relations: list, detail, CRUD, and reset-all custom action.
 */

import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";
import { buildMetaPayloadForPathSegment } from "../../hermes-dashboard/templates/table-v1/meta-for-path-segment";
import { registerTableV1CustomActionRoutes } from "../../hermes-dashboard/templates/table-v1/register-table-v1-custom-actions";
import { parsePagination } from "../../lib/list-pagination";
import { entityRelationsTableV1CustomActionRegistrations } from "./custom-actions";
import { entityRelationsHermesPathSegment } from "./dashboard-page";
import {
  listInclude,
  mapRowToDetailItem,
  mapRowToListItem,
} from "./list-mapper";
import { resolveEntityRelationEndpointIds } from "./lib/resolve-entity-relation-endpoints";
import {
  entityRelationCreateBodySchema,
  entityRelationUpdateBodySchema,
} from "./write-body-schemas";

/**
 * Maps table-v1 `sortBy` query values to a Prisma `orderBy` for {@link EntityRelation}.
 *
 * @param sortBy - Column key from the dashboard manifest (`sortableFields`).
 * @param sortDir - Ascending or descending.
 */
const resolveEntityRelationListOrderBy = (
  sortBy: string | undefined,
  sortDir: Prisma.SortOrder,
): Prisma.EntityRelationOrderByWithRelationInput => {
  switch (sortBy) {
    case "lastSeenAt":
      return { lastSeenAt: sortDir };
    case "createdAt":
      return { createdAt: sortDir };
    case "weight":
      return { weight: sortDir };
    case "fromEntityName":
      return { fromEntity: { canonicalName: sortDir } };
    case "toEntityName":
      return { toEntity: { canonicalName: sortDir } };
    case "relationTypeName":
      return { relationType: { name: sortDir } };
    default:
      return { lastSeenAt: "desc" };
  }
};

/**
 * Returns true when the error is a Prisma known request error with the given code.
 *
 * @param error - Caught unknown from Prisma.
 * @param code - Prisma error code (e.g. P2002).
 */
const isPrismaErrorCode = (error: unknown, code: string): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code: string }).code === code;

/**
 * Hermes `table-v1` API for entity relations (list, detail, create, update, delete).
 */
export const entityRelationsRoutes = new Hono();

/**
 * Table-v1 metadata for Hermes. Registered **before** `GET /:id` so `/meta` is not captured as an id
 * (see {@link buildMetaPayloadForPathSegment}).
 */
entityRelationsRoutes.get("/meta", (c) => {
  const meta = buildMetaPayloadForPathSegment(entityRelationsHermesPathSegment);
  if (!meta) {
    return c.json({ message: "Unknown dashboard resource" }, 404);
  }
  return c.json(meta);
});

/** Registers manifest-driven custom POST routes (e.g. reset all relations). */
registerTableV1CustomActionRoutes(
  entityRelationsRoutes,
  entityRelationsTableV1CustomActionRegistrations,
);

/** Creates a new entity relation from canonical names and relation type label. */
entityRelationsRoutes.post("/", async (c) => {
  const body = entityRelationCreateBodySchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  const resolved = await resolveEntityRelationEndpointIds(
    { entity: prisma.entity, relationType: prisma.relationType },
    body.data,
  );
  if (!resolved.ok) {
    return c.json({ message: resolved.message }, 400);
  }

  try {
    const created = await prisma.entityRelation.create({
      data: {
        fromEntityId: resolved.ids.fromEntityId,
        toEntityId: resolved.ids.toEntityId,
        relationTypeId: resolved.ids.relationTypeId,
        weight: body.data.weight,
      },
    });
    return c.json({ id: created.id }, 201);
  } catch (error: unknown) {
    if (isPrismaErrorCode(error, "P2002")) {
      return c.json(
        { message: "An entity relation with these endpoints already exists" },
        409,
      );
    }
    throw error;
  }
});

/** Paginated list of entity relations for the Hermes dashboard (search `q`; sort `sortBy` / `sortDir`). */
entityRelationsRoutes.get("/", async (c) => {
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
          {
            fromEntity: {
              canonicalName: { contains: query, mode: "insensitive" as const },
            },
          },
          {
            toEntity: {
              canonicalName: { contains: query, mode: "insensitive" as const },
            },
          },
          {
            relationType: {
              name: { contains: query, mode: "insensitive" as const },
            },
          },
        ],
      } satisfies Prisma.EntityRelationWhereInput)
    : undefined;

  const orderBy = resolveEntityRelationListOrderBy(sortBy, sortDir);

  const findManyArgs = {
    where,
    include: listInclude,
    skip,
    take: pageSize,
    orderBy,
  } satisfies Prisma.EntityRelationFindManyArgs;

  const [rows, total] = await Promise.all([
    prisma.entityRelation.findMany(findManyArgs),
    prisma.entityRelation.count({ where }),
  ]);

  const payload = tableV1ListResponseSchema.parse({
    items: rows.map(mapRowToListItem),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});

/** Updates an entity relation by id (resolves canonical names to foreign keys). */
entityRelationsRoutes.patch("/:id", async (c) => {
  const body = entityRelationUpdateBodySchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  const resolved = await resolveEntityRelationEndpointIds(
    { entity: prisma.entity, relationType: prisma.relationType },
    body.data,
  );
  if (!resolved.ok) {
    return c.json({ message: resolved.message }, 400);
  }

  try {
    const updated = await prisma.entityRelation.update({
      where: { id: c.req.param("id") },
      data: {
        fromEntityId: resolved.ids.fromEntityId,
        toEntityId: resolved.ids.toEntityId,
        relationTypeId: resolved.ids.relationTypeId,
        weight: body.data.weight,
      },
    });
    return c.json({ id: updated.id });
  } catch (error: unknown) {
    if (isPrismaErrorCode(error, "P2025")) {
      return c.json({ message: "Entity relation not found" }, 404);
    }
    if (isPrismaErrorCode(error, "P2002")) {
      return c.json(
        { message: "An entity relation with these endpoints already exists" },
        409,
      );
    }
    throw error;
  }
});

/** Deletes an entity relation by id (Hermes table row delete). */
entityRelationsRoutes.delete("/:id", async (c) => {
  const result = await prisma.entityRelation.deleteMany({
    where: { id: c.req.param("id") },
  });
  if (result.count < 1) {
    return c.json({ message: "Entity relation not found" }, 404);
  }
  return c.json({ ok: true });
});

/** Returns one entity relation by id for the Hermes detail page. */
entityRelationsRoutes.get("/:id", async (c) => {
  const row = await prisma.entityRelation.findUnique({
    where: { id: c.req.param("id") },
    include: listInclude,
  } satisfies Prisma.EntityRelationFindUniqueArgs);

  if (!row) {
    return c.json({ message: "Entity relation not found" }, 404);
  }

  return c.json(mapRowToDetailItem(row));
});
