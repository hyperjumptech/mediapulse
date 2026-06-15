import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma, type CollectionAgent } from "@mediapulse/database";
import { Hono } from "hono";
import { z } from "zod";

import { parsePagination } from "../../lib/list-pagination";
import { listInclude, mapRowToListItem } from "./list-mapper";

const agentFilterSchema = z.enum(["data-collection", "page-collection"]);
const statusFilterSchema = z.enum(["collected", "dropped", "failed"]);

/**
 * Hermes dashboard API for per-execution processed-URL outcomes (read-only paginated list).
 *
 * Required query param: `scheduleExecutionId` (UUID).
 * Optional filters: `tickerId`, `agent`, `status`.
 */
export const processedUrlsRoutes = new Hono();

processedUrlsRoutes.get("/", async (c) => {
  const scheduleExecutionIdResult = z
    .string()
    .uuid()
    .safeParse(c.req.query("scheduleExecutionId")?.trim() ?? "");

  if (!scheduleExecutionIdResult.success) {
    return c.json({ message: "scheduleExecutionId must be a valid UUID" }, 400);
  }

  const { page, pageSize } = parsePagination(
    c.req.query("page"),
    c.req.query("pageSize"),
  );
  const skip = (page - 1) * pageSize;

  const tickerFilter = z
    .string()
    .uuid()
    .safeParse(c.req.query("tickerId")?.trim() ?? "");
  const agentFilter = agentFilterSchema.safeParse(
    c.req.query("agent")?.trim() ?? "",
  );
  const statusFilter = statusFilterSchema.safeParse(
    c.req.query("status")?.trim() ?? "",
  );

  const agentDbValue: CollectionAgent | undefined = agentFilter.success
    ? agentFilter.data === "data-collection"
      ? "data_collection"
      : "page_collection"
    : undefined;

  const where = {
    scheduleExecutionId: scheduleExecutionIdResult.data,
    ...(tickerFilter.success ? { tickerId: tickerFilter.data } : {}),
    ...(agentDbValue !== undefined ? { agent: agentDbValue } : {}),
    ...(statusFilter.success ? { status: statusFilter.data } : {}),
  } satisfies Prisma.CollectionUrlOutcomeWhereInput;

  const findManyArgs = {
    where,
    include: listInclude,
    skip,
    take: pageSize,
    orderBy: { createdAt: "asc" as const },
  } satisfies Prisma.CollectionUrlOutcomeFindManyArgs;

  const [rows, total] = await Promise.all([
    prisma.collectionUrlOutcome.findMany(findManyArgs),
    prisma.collectionUrlOutcome.count({ where }),
  ]);

  const payload = tableV1ListResponseSchema.parse({
    items: rows.map(mapRowToListItem),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});
