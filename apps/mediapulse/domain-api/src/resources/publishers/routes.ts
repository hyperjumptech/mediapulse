import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";

import { buildMetaPayloadForPathSegment } from "../../hermes-dashboard/templates/table-v1/meta-for-path-segment";
import { parsePagination } from "../../lib/list-pagination";
import { publishersHermesPathSegment } from "./dashboard-page";
import {
  buildPublisherListOrderBy,
  buildPublisherListWhere,
  parsePublisherListSortField,
} from "./list-filters";
import { mapRowToListItem } from "./list-mapper";
import { parsePublisherNameSource } from "./name-source-labels";
import { publisherUpdateBodySchema } from "./write-body-schemas";

export const publishersRoutes = new Hono();

publishersRoutes.get("/", async (c) => {
  const { page, pageSize } = parsePagination(
    c.req.query("page"),
    c.req.query("pageSize"),
  );
  const skip = (page - 1) * pageSize;
  const where = buildPublisherListWhere({
    q: c.req.query("q"),
    nameSource: parsePublisherNameSource(c.req.query("nameSource")),
  });
  const orderBy = buildPublisherListOrderBy(
    parsePublisherListSortField(c.req.query("sortBy")),
    c.req.query("sortDir") === "asc" ? "asc" : "desc",
  );
  const findManyArgs = {
    where,
    skip,
    take: pageSize,
    orderBy,
  } satisfies Prisma.PublisherFindManyArgs;

  const [rows, total] = await Promise.all([
    prisma.publisher.findMany(findManyArgs),
    prisma.publisher.count({ where }),
  ]);

  const payload = tableV1ListResponseSchema.parse({
    items: rows.map(mapRowToListItem),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});

publishersRoutes.get("/meta", (c) => {
  const meta = buildMetaPayloadForPathSegment(publishersHermesPathSegment);
  if (!meta) {
    return c.json({ message: "Unknown dashboard resource" }, 404);
  }

  return c.json(meta);
});

publishersRoutes.get("/:id", async (c) => {
  const row = await prisma.publisher.findUnique({
    where: { id: c.req.param("id") },
  } satisfies Prisma.PublisherFindUniqueArgs);
  if (!row) {
    return c.json({ message: "Publisher not found" }, 404);
  }

  return c.json(mapRowToListItem(row));
});

publishersRoutes.patch("/:id", async (c) => {
  const body = publisherUpdateBodySchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ message: "Invalid request body" }, 400);
  }

  const displayName = body.data.displayName.replace(/\s+/g, " ");

  try {
    const updated = await prisma.publisher.update({
      where: { id: c.req.param("id") },
      data: { displayName, nameSource: "manual" },
    } satisfies Prisma.PublisherUpdateArgs);

    return c.json({ id: updated.id });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return c.json({ message: "Publisher not found" }, 404);
    }
    throw error;
  }
});
