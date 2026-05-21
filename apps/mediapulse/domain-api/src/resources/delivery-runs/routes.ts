import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";
import { z } from "zod";
import { buildMetaPayloadForPathSegment } from "../../hermes-dashboard/templates/table-v1/meta-for-path-segment";
import { registerTableV1CustomActionRoutes } from "../../hermes-dashboard/templates/table-v1/register-table-v1-custom-actions";
import { parsePagination } from "../../lib/list-pagination";
import { deliveryRunsTableV1CustomActionRegistrations } from "./custom-actions";
import {
  listInclude,
  mapRowToDetailItem,
  mapRowToListItem,
} from "./list-mapper";

const DELIVERY_RUNS_PATH_SEGMENT = "delivery-runs" as const;

const deliveryRunOutcomeFilterSchema = z.enum([
  "success",
  "skipped",
  "failed",
  "partial_success",
  "skipped_all_already_delivered",
]);

/**
 * Hermes `table-v1` API for delivery run diagnostics (list + read-only detail).
 */
export const deliveryRunsRoutes = new Hono();

deliveryRunsRoutes.get("/", async (c) => {
  const { page, pageSize } = parsePagination(
    c.req.query("page"),
    c.req.query("pageSize"),
  );
  const query = c.req.query("q")?.trim();
  const sortBy = c.req.query("sortBy");
  const sortDir: Prisma.SortOrder =
    c.req.query("sortDir") === "desc" ? "desc" : "asc";
  const skip = (page - 1) * pageSize;

  const tickerFilter = z
    .string()
    .uuid()
    .safeParse(c.req.query("tickerId")?.trim() ?? "");
  const outcomeFilter = deliveryRunOutcomeFilterSchema.safeParse(
    c.req.query("outcome")?.trim() ?? "",
  );
  const startRaw = c.req.query("start")?.trim();
  const endRaw = c.req.query("end")?.trim();
  const startDate =
    startRaw !== undefined && startRaw !== "" ? new Date(startRaw) : undefined;
  const endDate =
    endRaw !== undefined && endRaw !== "" ? new Date(endRaw) : undefined;

  const filterParts: Prisma.DeliveryRunWhereInput[] = [];
  if (query) {
    filterParts.push({
      OR: [
        {
          recipientErrorSummary: {
            contains: query,
            mode: "insensitive" as const,
          },
        },
        {
          ticker: {
            symbol: { contains: query, mode: "insensitive" as const },
          },
        },
      ],
    });
  }
  if (tickerFilter.success) {
    filterParts.push({ tickerId: tickerFilter.data });
  }
  if (outcomeFilter.success) {
    filterParts.push({ outcome: outcomeFilter.data });
  }
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (startDate !== undefined && !Number.isNaN(startDate.getTime())) {
    createdAt.gte = startDate;
  }
  if (endDate !== undefined && !Number.isNaN(endDate.getTime())) {
    createdAt.lte = endDate;
  }
  if (createdAt.gte !== undefined || createdAt.lte !== undefined) {
    filterParts.push({ createdAt });
  }

  const where =
    filterParts.length === 0
      ? undefined
      : filterParts.length === 1
        ? filterParts[0]
        : { AND: filterParts };

  const orderBy: Prisma.DeliveryRunOrderByWithRelationInput =
    sortBy === "outcome" ? { outcome: sortDir } : { createdAt: sortDir };

  const findManyArgs = {
    where,
    include: listInclude,
    skip,
    take: pageSize,
    orderBy,
  } satisfies Prisma.DeliveryRunFindManyArgs;

  const [rows, total] = await Promise.all([
    prisma.deliveryRun.findMany(findManyArgs),
    prisma.deliveryRun.count({ where }),
  ]);

  const payload = tableV1ListResponseSchema.parse({
    items: rows.map(mapRowToListItem),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});

deliveryRunsRoutes.get("/meta", (c) => {
  const meta = buildMetaPayloadForPathSegment(DELIVERY_RUNS_PATH_SEGMENT);
  if (!meta) {
    return c.json({ message: "Unknown dashboard resource" }, 404);
  }
  return c.json(meta);
});

deliveryRunsRoutes.get("/:id", async (c) => {
  const row = await prisma.deliveryRun.findUnique({
    where: { id: c.req.param("id") },
    include: {
      ticker: { select: { symbol: true } },
      recipients: true,
    },
  } satisfies Prisma.DeliveryRunFindUniqueArgs);

  if (!row) {
    return c.json({ message: "Delivery run not found" }, 404);
  }

  return c.json(mapRowToDetailItem(row));
});

registerTableV1CustomActionRoutes(
  deliveryRunsRoutes,
  deliveryRunsTableV1CustomActionRegistrations,
);
