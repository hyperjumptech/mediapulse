import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";
import { parsePagination } from "../../lib/list-pagination";
import { nullableText } from "../../lib/nullable-text";
import { mapRowToListItem } from "./list-mapper";
import {
  mediapulseUserCreateSchema,
  mediapulseUserUpdateSchema,
} from "./request-schemas";

/**
 * Hermes `table-v1` API for Mediapulse end users (newsletter subscribers, etc.).
 */
export const mediapulseUsersRoutes = new Hono();

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

  const where = query
    ? ({
        OR: [
          { email: { contains: query, mode: "insensitive" as const } },
          { name: { contains: query, mode: "insensitive" as const } },
        ],
      } satisfies Prisma.MediapulseUserWhereInput)
    : undefined;
  const orderBy =
    sortBy === "createdAt" ? { createdAt: sortDir } : { email: sortDir };

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

mediapulseUsersRoutes.post("/", async (c) => {
  const body = mediapulseUserCreateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  try {
    const created = await prisma.mediapulseUser.create({
      data: {
        email: body.data.email.trim().toLowerCase(),
        name: nullableText(body.data.name),
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

mediapulseUsersRoutes.patch("/:id", async (c) => {
  const body = mediapulseUserUpdateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  try {
    const updated = await prisma.mediapulseUser.update({
      where: { id: c.req.param("id") },
      data: {
        email: body.data.email.trim().toLowerCase(),
        name: nullableText(body.data.name),
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

mediapulseUsersRoutes.delete("/:id", async (c) => {
  const result = await prisma.mediapulseUser.deleteMany({
    where: { id: c.req.param("id") },
  });
  if (result.count < 1) {
    return c.json({ message: "User not found" }, 404);
  }
  return c.json({ ok: true });
});
