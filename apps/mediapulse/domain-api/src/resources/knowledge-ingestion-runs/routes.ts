import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";

import { buildMetaPayloadForPathSegment } from "../../hermes-dashboard/templates/table-v1/meta-for-path-segment";
import { parseCreatedDateBound } from "../../lib/parse-created-date-bound";
import { parsePagination } from "../../lib/list-pagination";
import { detailInclude, mapRowToDetailItem } from "./detail-mapper";
import { listInclude, mapRowToListItem } from "./list-mapper";

const KNOWLEDGE_INGESTION_RUNS_PATH_SEGMENT =
  "knowledge-ingestion-runs" as const;

export const knowledgeIngestionRunsRoutes = new Hono();

knowledgeIngestionRunsRoutes.get("/", async (c) => {
  const { page, pageSize } = parsePagination(
    c.req.query("page"),
    c.req.query("pageSize"),
  );
  const skip = (page - 1) * pageSize;
  const sortDir: Prisma.SortOrder =
    c.req.query("sortDir") === "asc" ? "asc" : "desc";

  const parts: Prisma.KnowledgeIngestionRunWhereInput[] = [];
  const status = c.req.query("status")?.trim();
  if (status !== undefined && status !== "") {
    parts.push({
      status: status as Prisma.KnowledgeIngestionRunWhereInput["status"],
    });
  }
  const from = parseCreatedDateBound(c.req.query("from"), "start");
  const to = parseCreatedDateBound(c.req.query("to"), "end");
  const startedAt: { gte?: Date; lte?: Date } = {};
  if (from && !Number.isNaN(from.getTime())) startedAt.gte = from;
  if (to && !Number.isNaN(to.getTime())) startedAt.lte = to;
  if (startedAt.gte !== undefined || startedAt.lte !== undefined) {
    parts.push({ startedAt });
  }

  const where =
    parts.length === 0
      ? undefined
      : parts.length === 1
        ? parts[0]
        : { AND: parts };

  const findManyArgs = {
    where,
    include: listInclude,
    skip,
    take: pageSize,
    orderBy: { startedAt: sortDir },
  } satisfies Prisma.KnowledgeIngestionRunFindManyArgs;

  const [rows, total] = await Promise.all([
    prisma.knowledgeIngestionRun.findMany(findManyArgs),
    prisma.knowledgeIngestionRun.count({ where }),
  ]);

  const payload = tableV1ListResponseSchema.parse({
    items: rows.map(mapRowToListItem),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});

knowledgeIngestionRunsRoutes.get("/meta", (c) => {
  const meta = buildMetaPayloadForPathSegment(
    KNOWLEDGE_INGESTION_RUNS_PATH_SEGMENT,
  );
  if (!meta) {
    return c.json({ message: "Unknown dashboard resource" }, 404);
  }

  return c.json(meta);
});

knowledgeIngestionRunsRoutes.get("/:id", async (c) => {
  const row = await prisma.knowledgeIngestionRun.findUnique({
    where: { id: c.req.param("id") },
    include: detailInclude,
  } satisfies Prisma.KnowledgeIngestionRunFindUniqueArgs);

  if (!row) {
    return c.json({ message: "Knowledge ingestion run not found" }, 404);
  }

  return c.json(mapRowToDetailItem(row));
});
