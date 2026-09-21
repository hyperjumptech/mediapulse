import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";
import { z } from "zod";

import { buildMetaPayloadForPathSegment } from "../../hermes-dashboard/templates/table-v1/meta-for-path-segment";
import { parseCreatedDateBound } from "../../lib/parse-created-date-bound";
import { parsePagination } from "../../lib/list-pagination";
import { detailInclude, mapRowToDetailItem } from "./detail-mapper";
import { listInclude, mapRowToListItem } from "./list-mapper";

const KNOWLEDGE_EXTRACTION_RUNS_PATH_SEGMENT =
  "knowledge-extraction-runs" as const;

/**
 * Builds the where clause for the runs list.
 *
 * @param input - Status, issuer and the started-at bounds from the query.
 */
export const buildRunsListWhere = (input: {
  status?: string;
  tickerId?: string;
  from?: Date | null;
  to?: Date | null;
}): Prisma.KnowledgeExtractionRunWhereInput | undefined => {
  const parts: Prisma.KnowledgeExtractionRunWhereInput[] = [];

  const status = input.status?.trim();
  if (status !== undefined && status !== "") {
    parts.push({
      status: status as Prisma.KnowledgeExtractionRunWhereInput["status"],
    });
  }
  if (input.tickerId !== undefined) {
    parts.push({ tickerId: input.tickerId });
  }

  const startedAt: { gte?: Date; lte?: Date } = {};
  if (input.from && !Number.isNaN(input.from.getTime())) {
    startedAt.gte = input.from;
  }
  if (input.to && !Number.isNaN(input.to.getTime())) {
    startedAt.lte = input.to;
  }
  if (startedAt.gte !== undefined || startedAt.lte !== undefined) {
    parts.push({ startedAt });
  }

  if (parts.length === 0) {
    return undefined;
  }

  return parts.length === 1 ? parts[0] : { AND: parts };
};

export const knowledgeExtractionRunsRoutes = new Hono();

knowledgeExtractionRunsRoutes.get("/", async (c) => {
  const { page, pageSize } = parsePagination(
    c.req.query("page"),
    c.req.query("pageSize"),
  );
  const skip = (page - 1) * pageSize;
  const sortDir: Prisma.SortOrder =
    c.req.query("sortDir") === "asc" ? "asc" : "desc";

  const tickerFilter = z
    .string()
    .uuid()
    .safeParse(c.req.query("tickerId")?.trim() ?? "");

  const where = buildRunsListWhere({
    status: c.req.query("status"),
    tickerId: tickerFilter.success ? tickerFilter.data : undefined,
    from: parseCreatedDateBound(c.req.query("from"), "start"),
    to: parseCreatedDateBound(c.req.query("to"), "end"),
  });

  const findManyArgs = {
    where,
    include: listInclude,
    skip,
    take: pageSize,
    orderBy: { startedAt: sortDir },
  } satisfies Prisma.KnowledgeExtractionRunFindManyArgs;

  const [rows, total] = await Promise.all([
    prisma.knowledgeExtractionRun.findMany(findManyArgs),
    prisma.knowledgeExtractionRun.count({ where }),
  ]);

  const payload = tableV1ListResponseSchema.parse({
    items: rows.map(mapRowToListItem),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});

knowledgeExtractionRunsRoutes.get("/meta", async (c) => {
  const base = buildMetaPayloadForPathSegment(
    KNOWLEDGE_EXTRACTION_RUNS_PATH_SEGMENT,
  );
  if (!base) {
    return c.json({ message: "Unknown dashboard resource" }, 404);
  }

  // Only issuers that have actually been extracted, so the filter cannot offer a ticker with no runs.
  const tickers = await prisma.ticker.findMany({
    where: { knowledgeExtractionRuns: { some: {} } },
    select: { id: true, symbol: true, name: true },
    orderBy: { symbol: "asc" },
  } satisfies Prisma.TickerFindManyArgs);

  return c.json({
    ...base,
    filterOptions: {
      tickerOptions: tickers.map((ticker) => ({
        value: ticker.id,
        label: `${ticker.symbol} — ${ticker.name}`,
      })),
    },
  });
});

knowledgeExtractionRunsRoutes.get("/:id", async (c) => {
  const row = await prisma.knowledgeExtractionRun.findUnique({
    where: { id: c.req.param("id") },
    include: detailInclude,
  } satisfies Prisma.KnowledgeExtractionRunFindUniqueArgs);

  if (!row) {
    return c.json({ message: "Extraction run not found" }, 404);
  }

  return c.json(mapRowToDetailItem(row));
});
