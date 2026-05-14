import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { Hono } from "hono";
import { z } from "zod";

import { buildMetaPayloadForPathSegment } from "../../hermes-dashboard/templates/table-v1/meta-for-path-segment";
import { parsePagination } from "../../lib/list-pagination";
import { buildDeliveryAggregateMap } from "./delivery-aggregate";
import {
  buildNewsletterListOrderBy,
  buildNewsletterListWhere,
  type NewsletterListSortField,
} from "./list-filters";
import { listInclude, mapRowToListItem } from "./list-mapper";

const NEWSLETTERS_PATH_SEGMENT = "newsletters" as const;

/**
 * Hermes `table-v1` API for read-only newsletters (list + meta).
 * Detail handler lands in #462 along with the manifest `detailBlocks`.
 */
export const newslettersRoutes = new Hono();

const parseSortBy = (
  raw: string | undefined,
): NewsletterListSortField | undefined => {
  if (raw === "subject") return "subject";
  if (raw === "createdAt") return "createdAt";
  return undefined;
};

const parseDate = (raw: string | undefined): Date | undefined => {
  if (raw === undefined || raw.trim() === "") return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

newslettersRoutes.get("/", async (c) => {
  const { page, pageSize } = parsePagination(
    c.req.query("page"),
    c.req.query("pageSize"),
  );
  const skip = (page - 1) * pageSize;

  const tickerFilter = z
    .string()
    .uuid()
    .safeParse(c.req.query("tickerId")?.trim() ?? "");

  const where = buildNewsletterListWhere({
    q: c.req.query("q"),
    tickerId: tickerFilter.success ? tickerFilter.data : undefined,
    from: parseDate(c.req.query("from")),
    to: parseDate(c.req.query("to")),
  });

  const orderBy = buildNewsletterListOrderBy(
    parseSortBy(c.req.query("sortBy")),
    c.req.query("sortDir") === "asc" ? "asc" : "desc",
  );

  const findManyArgs = {
    where,
    include: listInclude,
    skip,
    take: pageSize,
    orderBy,
  } satisfies Prisma.NewsletterFindManyArgs;

  const [rows, total] = await Promise.all([
    prisma.newsletter.findMany(findManyArgs),
    prisma.newsletter.count({ where }),
  ]);

  const aggregates = await buildDeliveryAggregateMap(
    rows.map((row) => ({ id: row.id, tickerId: row.tickerId })),
    {
      newsletterDeliveryCheckpoint: prisma.newsletterDeliveryCheckpoint,
      deliveryRun: prisma.deliveryRun,
      userTicker: prisma.userTicker,
    },
  );

  const payload = tableV1ListResponseSchema.parse({
    items: rows.map((row) =>
      mapRowToListItem(
        row,
        aggregates.get(row.id) ?? {
          deliveryDelivered: 0,
          deliveryEnabledAtSendTime: 0,
          deliveryHasRun: false,
        },
      ),
    ),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});

newslettersRoutes.get("/meta", async (c) => {
  const base = buildMetaPayloadForPathSegment(NEWSLETTERS_PATH_SEGMENT);
  if (!base) {
    return c.json({ message: "Unknown dashboard resource" }, 404);
  }

  const tickerOptions = await prisma.ticker.findMany({
    select: { id: true, symbol: true, name: true },
    orderBy: { symbol: "asc" },
  } satisfies Prisma.TickerFindManyArgs);

  return c.json({
    ...base,
    tickerOptions: tickerOptions.map((ticker) => ({
      value: ticker.id,
      label: `${ticker.symbol} — ${ticker.name}`,
    })),
  });
});
