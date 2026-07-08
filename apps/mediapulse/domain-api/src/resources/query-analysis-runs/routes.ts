import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";
import { z } from "zod";
import { buildMetaPayloadForPathSegment } from "../../hermes-dashboard/templates/table-v1/meta-for-path-segment";
import { parsePagination } from "../../lib/list-pagination";
import {
  listInclude,
  mapRowToDetailItem,
  mapRowToListItem,
} from "./list-mapper";

const QUERY_ANALYSIS_RUNS_PATH_SEGMENT = "query-analysis-runs" as const;

/**
 * Hermes `table-v1` API for the query-analysis run chronicle (list + read-only detail).
 */
export const queryAnalysisRunsRoutes = new Hono();

queryAnalysisRunsRoutes.get("/", async (c) => {
  const { page, pageSize } = parsePagination(
    c.req.query("page"),
    c.req.query("pageSize"),
  );
  const query = c.req.query("q")?.trim();
  const sortDir: Prisma.SortOrder =
    c.req.query("sortDir") === "asc" ? "asc" : "desc";
  const skip = (page - 1) * pageSize;

  const tickerFilter = z
    .string()
    .uuid()
    .safeParse(c.req.query("tickerId")?.trim() ?? "");
  const startRaw = c.req.query("start")?.trim();
  const endRaw = c.req.query("end")?.trim();
  const startDate =
    startRaw !== undefined && startRaw !== "" ? new Date(startRaw) : undefined;
  const endDate =
    endRaw !== undefined && endRaw !== "" ? new Date(endRaw) : undefined;

  const filterParts: Prisma.QueryAnalysisRunWhereInput[] = [];
  if (query) {
    filterParts.push({
      ticker: { symbol: { contains: query, mode: "insensitive" as const } },
    });
  }
  if (tickerFilter.success) {
    filterParts.push({ tickerId: tickerFilter.data });
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

  const findManyArgs = {
    where,
    include: listInclude,
    skip,
    take: pageSize,
    orderBy: { createdAt: sortDir },
  } satisfies Prisma.QueryAnalysisRunFindManyArgs;

  const [rows, total] = await Promise.all([
    prisma.queryAnalysisRun.findMany(findManyArgs),
    prisma.queryAnalysisRun.count({ where }),
  ]);

  const payload = tableV1ListResponseSchema.parse({
    items: rows.map(mapRowToListItem),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});

queryAnalysisRunsRoutes.get("/meta", (c) => {
  const meta = buildMetaPayloadForPathSegment(QUERY_ANALYSIS_RUNS_PATH_SEGMENT);
  if (!meta) {
    return c.json({ message: "Unknown dashboard resource" }, 404);
  }
  return c.json(meta);
});

queryAnalysisRunsRoutes.get("/:id", async (c) => {
  const row = await prisma.queryAnalysisRun.findUnique({
    where: { id: c.req.param("id") },
    include: listInclude,
  } satisfies Prisma.QueryAnalysisRunFindUniqueArgs);

  if (!row) {
    return c.json({ message: "Query analysis run not found" }, 404);
  }

  return c.json(mapRowToDetailItem(row));
});
