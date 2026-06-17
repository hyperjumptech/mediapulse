import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";
import { z } from "zod";

import { parsePagination } from "../../lib/list-pagination";
import {
  agentFilterSchema,
  buildProcessedUrlListWhere,
  gateStatusFilterSchema,
  statusFilterSchema,
} from "./list-filters";
import { listInclude, mapRowToListItem } from "./list-mapper";

/**
 * Hermes dashboard API for per-execution processed-URL outcomes (read-only paginated list).
 *
 * Optional query params: `scheduleExecutionId`, `tickerId`, `agent`, `status`,
 * `curatedSourceId`, `gateStatus`.
 */
export const processedUrlsRoutes = new Hono();

processedUrlsRoutes.get("/", async (c) => {
  const scheduleExecutionIdResult = z
    .string()
    .uuid()
    .safeParse(c.req.query("scheduleExecutionId")?.trim() ?? "");

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
  const curatedSourceFilter = z
    .string()
    .uuid()
    .safeParse(c.req.query("curatedSourceId")?.trim() ?? "");
  const gateStatusFilter = gateStatusFilterSchema.safeParse(
    c.req.query("gateStatus")?.trim() ?? "",
  );

  const where = buildProcessedUrlListWhere({
    scheduleExecutionId: scheduleExecutionIdResult.success
      ? scheduleExecutionIdResult.data
      : undefined,
    tickerId: tickerFilter.success ? tickerFilter.data : undefined,
    agent: agentFilter.success ? agentFilter.data : undefined,
    status: statusFilter.success ? statusFilter.data : undefined,
    curatedSourceId: curatedSourceFilter.success
      ? curatedSourceFilter.data
      : undefined,
    gateStatus: gateStatusFilter.success ? gateStatusFilter.data : undefined,
  });

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
