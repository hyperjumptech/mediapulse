/**
 * HTTP handlers for Mediapulse users: list, create, update, delete (with email uniqueness errors).
 */

import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";
import { parsePagination } from "../../lib/list-pagination";
import { nullableText } from "../../lib/nullable-text";
import { mapRowToListItem } from "./list-mapper";
import {
  mediapulseUserCreateBodySchema,
  mediapulseUserUpdateBodySchema,
} from "./write-body-schemas";

/**
 * Hermes `table-v1` API for Mediapulse end users (newsletter subscribers, etc.).
 */
export const mediapulseUsersRoutes = new Hono();

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
 * Builds the Prisma `where` clause for the mediapulse-users list endpoint.
 *
 * @param query - Optional search string for email/name.
 * @param enabled - Optional enabled filter from query params.
 * @returns Combined where input or `undefined` when no filters apply.
 */
const buildMediapulseUserListWhere = (
  query: string | undefined,
  enabled: boolean | undefined,
): Prisma.MediapulseUserWhereInput | undefined => {
  const parts: Prisma.MediapulseUserWhereInput[] = [];

  if (query) {
    parts.push({
      OR: [
        { email: { contains: query, mode: "insensitive" as const } },
        { name: { contains: query, mode: "insensitive" as const } },
      ],
    });
  }

  if (enabled !== undefined) {
    parts.push({ enabled });
  }

  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return { AND: parts };
};

/** Paginated list of Mediapulse end users for the Hermes dashboard table (search `q`, `sortBy`, `sortDir`). */
mediapulseUsersRoutes.get("/", async (c) => {
  const { page, pageSize } = parsePagination(
    c.req.query("page"),
    c.req.query("pageSize"),
  );
  const query = c.req.query("q")?.trim();
  const sortBy = c.req.query("sortBy");
  const sortDir: Prisma.SortOrder =
    c.req.query("sortDir") === "desc" ? "desc" : "asc";
  const skip = (page - 1) * pageSize;

  const where = buildMediapulseUserListWhere(
    query,
    parseEnabledFilter(c.req.query("enabled")),
  );
  const orderBy =
    sortBy === "createdAt"
      ? { createdAt: sortDir }
      : sortBy === "enabled"
        ? { enabled: sortDir }
        : { email: sortDir };

  const [rows, total] = await Promise.all([
    prisma.mediapulseUser.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
    }),
    prisma.mediapulseUser.count({ where }),
  ]);

  const payload = tableV1ListResponseSchema.parse({
    items: rows.map(mapRowToListItem),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});

/** Creates a Mediapulse user (email + optional name); returns 409 when email is already taken. */
mediapulseUsersRoutes.post("/", async (c) => {
  const body = mediapulseUserCreateBodySchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  try {
    const created = await prisma.mediapulseUser.create({
      data: {
        email: body.data.email.trim().toLowerCase(),
        name: nullableText(body.data.name),
        enabled: body.data.enabled,
      },
    });
    return c.json({ id: created.id }, 201);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return c.json({ message: "Email already exists" }, 409);
    }
    throw e;
  }
});

/** Updates a Mediapulse user by id; returns 404 if missing, 409 on duplicate email. */
mediapulseUsersRoutes.patch("/:id", async (c) => {
  const body = mediapulseUserUpdateBodySchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  try {
    const updated = await prisma.mediapulseUser.update({
      where: { id: c.req.param("id") },
      data: {
        email: body.data.email.trim().toLowerCase(),
        name: nullableText(body.data.name),
        enabled: body.data.enabled,
      },
    });
    return c.json({ id: updated.id });
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2025"
    ) {
      return c.json({ message: "User not found" }, 404);
    }
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return c.json({ message: "Email already exists" }, 409);
    }
    throw e;
  }
});

/** Deletes a Mediapulse user by id (Hermes table row delete). */
mediapulseUsersRoutes.delete("/:id", async (c) => {
  const result = await prisma.mediapulseUser.deleteMany({
    where: { id: c.req.param("id") },
  });
  if (result.count < 1) {
    return c.json({ message: "User not found" }, 404);
  }
  return c.json({ ok: true });
});
