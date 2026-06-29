/**
 * HTTP handlers for read-only newsletter feedback: list and detail.
 */

import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import {
  prisma,
  Prisma,
  type FeedbackCategory,
  type FeedbackSentiment,
} from "@mediapulse/database";
import { Hono } from "hono";

import { buildMetaPayloadForPathSegment } from "../../hermes-dashboard/templates/table-v1/meta-for-path-segment";
import { parseCreatedDateBound } from "../../lib/parse-created-date-bound";
import { parsePagination } from "../../lib/list-pagination";
import { feedbackHermesPathSegment } from "./dashboard-page";
import { mapRowToDetailItem } from "./detail-mapper";
import { mapRowToListItem } from "./list-mapper";

/** Hermes `resource-table` API for read-only newsletter feedback (list, meta, detail). */
export const feedbackRoutes = new Hono();

const SENTIMENT_VALUES = new Set<FeedbackSentiment>([
  "positive",
  "negative",
  "neutral",
  "mixed",
]);

const CATEGORY_VALUES = new Set<FeedbackCategory>([
  "praise",
  "complaint",
  "feature_request",
  "bug",
  "question",
  "other",
]);

/**
 * Parses the optional sentiment filter from the query string.
 *
 * @param raw - Raw `sentiment` query parameter.
 * @returns A valid `FeedbackSentiment`, or `undefined` when unset or invalid.
 */
const parseSentimentFilter = (
  raw: string | undefined,
): FeedbackSentiment | undefined => {
  const trimmed = raw?.trim();
  if (trimmed && SENTIMENT_VALUES.has(trimmed as FeedbackSentiment)) {
    return trimmed as FeedbackSentiment;
  }

  return undefined;
};

/**
 * Parses the optional category filter from the query string.
 *
 * @param raw - Raw `category` query parameter.
 * @returns A valid `FeedbackCategory`, or `undefined` when unset or invalid.
 */
const parseCategoryFilter = (
  raw: string | undefined,
): FeedbackCategory | undefined => {
  const trimmed = raw?.trim();
  if (trimmed && CATEGORY_VALUES.has(trimmed as FeedbackCategory)) {
    return trimmed as FeedbackCategory;
  }

  return undefined;
};

/**
 * Builds the Prisma `where` clause for the feedback list endpoint.
 *
 * @param filters - Parsed search and filter values from the query string.
 * @returns Combined where input, or `undefined` when no filters apply.
 */
const buildFeedbackListWhere = (filters: {
  q: string | undefined;
  sentiment: FeedbackSentiment | undefined;
  category: FeedbackCategory | undefined;
  from: Date | undefined;
  to: Date | undefined;
}): Prisma.NewsletterFeedbackWhereInput | undefined => {
  const parts: Prisma.NewsletterFeedbackWhereInput[] = [];

  if (filters.q) {
    parts.push({
      OR: [
        { senderEmail: { contains: filters.q, mode: "insensitive" as const } },
        { subject: { contains: filters.q, mode: "insensitive" as const } },
      ],
    });
  }

  if (filters.sentiment !== undefined) {
    parts.push({ sentiment: filters.sentiment });
  }

  if (filters.category !== undefined) {
    parts.push({ category: filters.category });
  }

  if (filters.from !== undefined || filters.to !== undefined) {
    parts.push({
      receivedAt: {
        ...(filters.from !== undefined ? { gte: filters.from } : {}),
        ...(filters.to !== undefined ? { lte: filters.to } : {}),
      },
    });
  }

  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];

  return { AND: parts };
};

/** Paginated list of newsletter feedback for the Hermes dashboard table. */
feedbackRoutes.get("/", async (c) => {
  const { page, pageSize } = parsePagination(
    c.req.query("page"),
    c.req.query("pageSize"),
  );
  const skip = (page - 1) * pageSize;

  const where = buildFeedbackListWhere({
    q: c.req.query("q")?.trim() || undefined,
    sentiment: parseSentimentFilter(c.req.query("sentiment")),
    category: parseCategoryFilter(c.req.query("category")),
    from: parseCreatedDateBound(c.req.query("from"), "start"),
    to: parseCreatedDateBound(c.req.query("to"), "end"),
  });

  const sortDir: Prisma.SortOrder =
    c.req.query("sortDir") === "asc" ? "asc" : "desc";
  const orderBy =
    c.req.query("sortBy") === "senderEmail"
      ? { senderEmail: sortDir }
      : { receivedAt: sortDir };

  const findManyArgs = {
    where,
    skip,
    take: pageSize,
    orderBy,
  } satisfies Prisma.NewsletterFeedbackFindManyArgs;

  const [rows, total] = await Promise.all([
    prisma.newsletterFeedback.findMany(findManyArgs),
    prisma.newsletterFeedback.count({ where }),
  ]);

  const payload = tableV1ListResponseSchema.parse({
    items: rows.map(mapRowToListItem),
    total,
    page,
    pageSize,
  });

  return c.json(payload);
});

/**
 * Table metadata (columns, filters, detail blocks) for the feedback resource.
 * Declared here because the `/:id` route below would otherwise capture the
 * `meta` segment before the central manifest handler sees it.
 */
feedbackRoutes.get("/meta", (c) => {
  const meta = buildMetaPayloadForPathSegment(feedbackHermesPathSegment);
  if (!meta) {
    return c.json({ message: "Unknown dashboard resource" }, 404);
  }

  return c.json(meta);
});

/** Detail payload for a single newsletter feedback row. */
feedbackRoutes.get("/:id", async (c) => {
  const row = await prisma.newsletterFeedback.findUnique({
    where: { id: c.req.param("id") },
  });

  if (!row) {
    return c.json({ message: "Feedback not found" }, 404);
  }

  return c.json(mapRowToDetailItem(row));
});
