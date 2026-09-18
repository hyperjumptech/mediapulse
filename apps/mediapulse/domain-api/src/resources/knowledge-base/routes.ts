import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";

import { buildMetaPayloadForPathSegment } from "../../hermes-dashboard/templates/table-v1/meta-for-path-segment";
import { parsePagination } from "../../lib/list-pagination";
import { buildKnowledgeArticleCounts } from "./list-aggregates";
import {
  buildKnowledgeBaseListOrderBy,
  buildKnowledgeBaseListWhere,
  parseKnowledgeBaseSortBy,
} from "./list-filters";
import {
  detailInclude,
  mapRowToDetailItem,
  KB_ENTITY_FETCH_CAP,
} from "./detail-mapper";
import { listInclude, mapRowToListItem } from "./list-mapper";

const KNOWLEDGE_BASE_PATH_SEGMENT = "knowledge-base" as const;

/** Mentions read for one detail page, across every entity. */
const MENTION_FETCH_CAP = 1_000;

export const knowledgeBaseRoutes = new Hono();

knowledgeBaseRoutes.get("/", async (c) => {
  const { page, pageSize } = parsePagination(
    c.req.query("page"),
    c.req.query("pageSize"),
  );
  const skip = (page - 1) * pageSize;

  const where = buildKnowledgeBaseListWhere({ q: c.req.query("q") });
  const orderBy = buildKnowledgeBaseListOrderBy(
    parseKnowledgeBaseSortBy(c.req.query("sortBy")),
    c.req.query("sortDir") === "desc" ? "desc" : "asc",
  );

  const [rows, total] = await Promise.all([
    prisma.ticker.findMany({
      where,
      include: listInclude,
      skip,
      take: pageSize,
      orderBy,
    } satisfies Prisma.TickerFindManyArgs),
    prisma.ticker.count({ where }),
  ]);

  const articleCounts = await buildKnowledgeArticleCounts(
    rows.map((row) => row.id),
    { knowledgeEntityMention: prisma.knowledgeEntityMention },
  );

  const payload = tableV1ListResponseSchema.parse({
    items: rows.map((row) =>
      mapRowToListItem(row, articleCounts.get(row.id) ?? 0),
    ),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});

knowledgeBaseRoutes.get("/meta", (c) => {
  const base = buildMetaPayloadForPathSegment(KNOWLEDGE_BASE_PATH_SEGMENT);
  if (!base) {
    return c.json({ message: "Unknown dashboard resource" }, 404);
  }

  return c.json(base);
});

knowledgeBaseRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const row = await prisma.ticker.findUnique({
    where: { id },
    include: detailInclude,
  } satisfies Prisma.TickerFindUniqueArgs);

  if (!row || row.knowledgeTickerEntities.length === 0) {
    return c.json({ message: "This issuer has no knowledge base yet" }, 404);
  }

  const mentions = await prisma.knowledgeEntityMention.findMany({
    where: {
      tickerId: id,
      entityId: {
        in: row.knowledgeTickerEntities
          .slice(0, KB_ENTITY_FETCH_CAP)
          .map((link) => link.entityId),
      },
    },
    orderBy: [{ dataSource: { publishedAt: "desc" } }, { createdAt: "desc" }],
    take: MENTION_FETCH_CAP,
    select: {
      entityId: true,
      dataSourceId: true,
      surfaceForm: true,
      evidenceSpan: true,
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
  } satisfies Prisma.KnowledgeEntityMentionFindManyArgs);

  return c.json(mapRowToDetailItem(row, mentions));
});
