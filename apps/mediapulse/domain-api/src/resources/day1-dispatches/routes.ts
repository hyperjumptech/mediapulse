import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import {
  prisma,
  type Day1DispatchKind,
  type Day1DispatchStatus,
  type Prisma,
} from "@mediapulse/database";
import { Hono } from "hono";

import { buildMetaPayloadForPathSegment } from "../../hermes-dashboard/templates/table-v1/meta-for-path-segment";
import { parsePagination } from "../../lib/list-pagination";
import { parseCreatedDateBound } from "../../lib/parse-created-date-bound";
import { day1DispatchesHermesPathSegment } from "./dashboard-page";
import {
  DAY1_DISPATCH_KIND_LABELS,
  DAY1_DISPATCH_STATUS_LABELS,
  day1DispatchInclude,
  mapRowToDetailItem,
  mapRowToListItem,
} from "./list-mapper";

export const day1DispatchesRoutes = new Hono();

const parseEnumFilter = <Value extends string>(
  raw: string | undefined,
  allowed: Record<Value, string>,
): Value | undefined => {
  const trimmed = raw?.trim();
  if (!trimmed || !Object.prototype.hasOwnProperty.call(allowed, trimmed)) {
    return undefined;
  }

  return trimmed as Value;
};

type Day1DispatchListFilters = {
  q: string | undefined;
  status: Day1DispatchStatus | undefined;
  kind: Day1DispatchKind | undefined;
  tickerId: string | undefined;
  from: Date | undefined;
  to: Date | undefined;
};

export const buildDay1DispatchListWhere = (
  filters: Day1DispatchListFilters,
): Prisma.Day1NewsletterDispatchWhereInput => {
  const createdAtRange =
    filters.from !== undefined || filters.to !== undefined
      ? {
          createdAt: {
            ...(filters.from !== undefined ? { gte: filters.from } : {}),
            ...(filters.to !== undefined ? { lte: filters.to } : {}),
          },
        }
      : {};
  const search = filters.q
    ? {
        OR: [
          {
            ticker: {
              symbol: { contains: filters.q, mode: "insensitive" as const },
            },
          },
          {
            userTicker: {
              user: {
                email: { contains: filters.q, mode: "insensitive" as const },
              },
            },
          },
        ],
      }
    : {};

  return {
    ...search,
    ...(filters.status !== undefined ? { status: filters.status } : {}),
    ...(filters.kind !== undefined ? { kind: filters.kind } : {}),
    ...(filters.tickerId !== undefined ? { tickerId: filters.tickerId } : {}),
    ...createdAtRange,
  };
};

day1DispatchesRoutes.get("/", async (c) => {
  const { page, pageSize } = parsePagination(
    c.req.query("page"),
    c.req.query("pageSize"),
  );
  const where = buildDay1DispatchListWhere({
    q: c.req.query("q")?.trim() || undefined,
    status: parseEnumFilter(c.req.query("status"), DAY1_DISPATCH_STATUS_LABELS),
    kind: parseEnumFilter(c.req.query("kind"), DAY1_DISPATCH_KIND_LABELS),
    tickerId: c.req.query("tickerId")?.trim() || undefined,
    from: parseCreatedDateBound(c.req.query("from"), "start"),
    to: parseCreatedDateBound(c.req.query("to"), "end"),
  });
  const sortDir: Prisma.SortOrder =
    c.req.query("sortDir") === "asc" ? "asc" : "desc";
  const findManyArgs = {
    where,
    include: day1DispatchInclude,
    orderBy: { createdAt: sortDir },
    skip: (page - 1) * pageSize,
    take: pageSize,
  } satisfies Prisma.Day1NewsletterDispatchFindManyArgs;
  const [rows, total] = await Promise.all([
    prisma.day1NewsletterDispatch.findMany(findManyArgs),
    prisma.day1NewsletterDispatch.count({ where }),
  ]);
  const payload = tableV1ListResponseSchema.parse({
    items: rows.map(mapRowToListItem),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});

day1DispatchesRoutes.get("/meta", async (c) => {
  const base = buildMetaPayloadForPathSegment(day1DispatchesHermesPathSegment);
  if (!base) {
    return c.json({ message: "Unknown dashboard resource" }, 404);
  }
  const tickerFindManyArgs = {
    where: { day1NewsletterDispatches: { some: {} } },
    select: { id: true, symbol: true, name: true },
    orderBy: { symbol: "asc" },
  } satisfies Prisma.TickerFindManyArgs;
  const tickers = await prisma.ticker.findMany(tickerFindManyArgs);

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

day1DispatchesRoutes.get("/:id", async (c) => {
  const row = await prisma.day1NewsletterDispatch.findUnique({
    where: { id: c.req.param("id") },
    include: day1DispatchInclude,
  });
  if (!row) {
    return c.json({ message: "Day 1 dispatch not found" }, 404);
  }

  return c.json(mapRowToDetailItem(row));
});
