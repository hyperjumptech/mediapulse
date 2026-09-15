import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";
import { z } from "zod";

import { buildMetaPayloadForPathSegment } from "../../hermes-dashboard/templates/table-v1/meta-for-path-segment";
import { parseCreatedDateBound } from "../../lib/parse-created-date-bound";
import { parsePagination } from "../../lib/list-pagination";
import { buildStorylineCitationCounts } from "./list-aggregates";
import {
  buildStorylineListOrderBy,
  buildStorylineListWhere,
  parseStorylineKind,
  parseStorylineLocked,
  parseStorylineSortBy,
} from "./list-filters";
import {
  detailInclude,
  mapRowToDetailItem,
  STORYLINE_CITATION_FETCH_CAP,
} from "./detail-mapper";
import { listInclude, mapRowToListItem } from "./list-mapper";

const STORYLINES_PATH_SEGMENT = "storylines" as const;

export const storylinesRoutes = new Hono();

storylinesRoutes.get("/", async (c) => {
  const { page, pageSize } = parsePagination(
    c.req.query("page"),
    c.req.query("pageSize"),
  );
  const skip = (page - 1) * pageSize;

  const tickerFilter = z
    .string()
    .uuid()
    .safeParse(c.req.query("tickerId")?.trim() ?? "");

  const where = buildStorylineListWhere({
    q: c.req.query("q"),
    kind: parseStorylineKind(c.req.query("kind")?.trim()),
    locked: parseStorylineLocked(c.req.query("locked")?.trim()),
    tickerId: tickerFilter.success ? tickerFilter.data : undefined,
    from: parseCreatedDateBound(c.req.query("from"), "start"),
    to: parseCreatedDateBound(c.req.query("to"), "end"),
  });

  const orderBy = buildStorylineListOrderBy(
    parseStorylineSortBy(c.req.query("sortBy")),
    c.req.query("sortDir") === "asc" ? "asc" : "desc",
  );

  const findManyArgs = {
    where,
    include: listInclude,
    skip,
    take: pageSize,
    orderBy,
  } satisfies Prisma.StorylineFindManyArgs;

  const [rows, total] = await Promise.all([
    prisma.storyline.findMany(findManyArgs),
    prisma.storyline.count({ where }),
  ]);

  const citationCounts = await buildStorylineCitationCounts(
    rows.map((row) => row.id),
    { development: prisma.development },
  );

  const payload = tableV1ListResponseSchema.parse({
    items: rows.map((row) =>
      mapRowToListItem(row, citationCounts.get(row.id) ?? 0),
    ),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});

storylinesRoutes.get("/meta", async (c) => {
  const base = buildMetaPayloadForPathSegment(STORYLINES_PATH_SEGMENT);
  if (!base) {
    return c.json({ message: "Unknown dashboard resource" }, 404);
  }

  const tickerOptions = await prisma.ticker.findMany({
    select: { id: true, symbol: true, name: true },
    orderBy: { symbol: "asc" },
  } satisfies Prisma.TickerFindManyArgs);

  return c.json({
    ...base,
    filterOptions: {
      tickerOptions: tickerOptions.map((ticker) => ({
        value: ticker.id,
        label: `${ticker.symbol} — ${ticker.name}`,
      })),
    },
  });
});

storylinesRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const row = await prisma.storyline.findUnique({
    where: { id },
    include: detailInclude,
  } satisfies Prisma.StorylineFindUniqueArgs);

  if (!row) {
    return c.json({ message: "Storyline not found" }, 404);
  }

  const citations = await prisma.developmentCitation.findMany({
    where: { development: { storylineId: id } },
    orderBy: [{ development: { observedAt: "asc" } }, { createdAt: "asc" }],
    take: STORYLINE_CITATION_FETCH_CAP,
    select: {
      id: true,
      createdAt: true,
      developmentId: true,
      dataSourceId: true,
      dataSource: {
        select: {
          id: true,
          title: true,
          url: true,
          registrableDomain: true,
          publishedAt: true,
        },
      },
    },
  } satisfies Prisma.DevelopmentCitationFindManyArgs);

  return c.json(mapRowToDetailItem(row, citations));
});
