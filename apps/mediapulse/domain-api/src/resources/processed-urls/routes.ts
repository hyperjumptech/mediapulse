import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";
import { z } from "zod";

import { parsePagination } from "../../lib/list-pagination";
import {
  buildProcessedUrlListWhere,
  gateStatusFilterSchema,
  statusFilterSchema,
} from "./list-filters";
import {
  listInclude,
  mapRowToListItem,
  PROCESSED_URL_SUBJECT_TITLE,
} from "./list-mapper";

export const processedUrlsRoutes = new Hono();

const readTrimmedQuery = (value: string | undefined): string =>
  value?.trim() ?? "";

processedUrlsRoutes.get("/", async (c) => {
  const scheduleExecutionIdResult = z
    .guid()
    .safeParse(readTrimmedQuery(c.req.query("scheduleExecutionId")));

  const { page, pageSize } = parsePagination(
    c.req.query("page"),
    c.req.query("pageSize"),
  );
  const skip = (page - 1) * pageSize;

  const subjectIdParam =
    readTrimmedQuery(c.req.query("subjectId")) ||
    readTrimmedQuery(c.req.query("tickerId"));
  const subjectFilter = z.guid().safeParse(subjectIdParam);
  const agentFilter = readTrimmedQuery(c.req.query("agent"));
  const statusFilter = statusFilterSchema.safeParse(
    readTrimmedQuery(c.req.query("status")),
  );
  const curatedSourceFilter = z
    .guid()
    .safeParse(readTrimmedQuery(c.req.query("curatedSourceId")));
  const gateStatusFilter = gateStatusFilterSchema.safeParse(
    readTrimmedQuery(c.req.query("gateStatus")),
  );

  const where = buildProcessedUrlListWhere({
    scheduleExecutionId: scheduleExecutionIdResult.success
      ? scheduleExecutionIdResult.data
      : undefined,
    subjectId: subjectFilter.success ? subjectFilter.data : undefined,
    agent: agentFilter || undefined,
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

  const listPayload = tableV1ListResponseSchema.parse({
    items: rows.map(mapRowToListItem),
    total,
    page,
    pageSize,
  });

  return c.json({ ...listPayload, subjectTitle: PROCESSED_URL_SUBJECT_TITLE });
});
