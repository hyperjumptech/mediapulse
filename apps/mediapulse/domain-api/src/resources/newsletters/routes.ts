import { tableV1ListResponseSchema } from "@hermes/domain-contract";
import { prisma, Prisma } from "@mediapulse/database";
import { logger } from "@workspace/logger";
import { Hono } from "hono";
import { z } from "zod";

import { buildMetaPayloadForPathSegment } from "../../hermes-dashboard/templates/table-v1/meta-for-path-segment";
import { registerTableV1CustomActionRoutes } from "../../hermes-dashboard/templates/table-v1/register-table-v1-custom-actions";
import { parseCreatedDateBound } from "../../lib/parse-created-date-bound";
import { parsePagination } from "../../lib/list-pagination";
import { newslettersTableV1CustomActionRegistrations } from "./custom-actions";
import { findQuerySetForNewsletter } from "./active-query-set";
import { buildCitedArticles } from "./build-cited-articles";
import { buildSourceCollection } from "./build-source-collection";
import { buildHermesLinks } from "./build-hermes-links";
import {
  buildRecipients,
  NEWSLETTER_DETAIL_RECIPIENTS_CAP,
} from "./build-recipients";
import { buildDeliveryAggregateMap } from "./delivery-aggregate";
import { detailInclude, mapRowToDetailItem } from "./detail-mapper";
import { renderEmailPreview } from "./render-email-preview";
import {
  buildNewsletterListOrderBy,
  buildNewsletterListWhere,
  type NewsletterListSortField,
} from "./list-filters";
import { listInclude, mapRowToListItem } from "./list-mapper";

const NEWSLETTERS_PATH_SEGMENT = "newsletters" as const;

/**
 * Hermes `table-v1` API for read-only newsletters (list, meta, detail).
 * The detail handler returns the full payload defined by the
 * `hermes-admin-newsletter-visibility` PRD §5; the manifest declares
 * `detailBlocks` so the Hermes dashboard renders it via the generic detail
 * page.
 */
export const newslettersRoutes = new Hono();

const parseSortBy = (
  raw: string | undefined,
): NewsletterListSortField | undefined => {
  if (raw === "subject") return "subject";
  if (raw === "createdAt") return "createdAt";
  return undefined;
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
    from: parseCreatedDateBound(c.req.query("from"), "start"),
    to: parseCreatedDateBound(c.req.query("to"), "end"),
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
    filterOptions: {
      tickerOptions: tickerOptions.map((ticker) => ({
        value: ticker.id,
        label: `${ticker.symbol} — ${ticker.name}`,
      })),
    },
  });
});

newslettersRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const findUniqueArgs = {
    where: { id },
    include: detailInclude,
  } satisfies Prisma.NewsletterFindUniqueArgs;
  const row = await prisma.newsletter.findUnique(findUniqueArgs);

  if (!row) {
    return c.json({ message: "Newsletter not found" }, 404);
  }

  const [
    recipientsResult,
    citedArticles,
    sourceCollection,
    activeQuerySet,
    hermesLinks,
    emailPreviewHtml,
  ] = await Promise.all([
    buildRecipients(row.id, row.tickerId, {
      userTicker: prisma.userTicker,
      newsletterDeliveryCheckpoint: prisma.newsletterDeliveryCheckpoint,
      deliveryRun: prisma.deliveryRun,
    }),
    buildCitedArticles(row.id, row.tickerId, {
      newsletterCitation: prisma.newsletterCitation,
    }),
    buildSourceCollection(row.id, {
      newsletterCitation: prisma.newsletterCitation,
      dataCollectionRun: prisma.dataCollectionRun,
    }),
    findQuerySetForNewsletter(row.searchQuerySetId, {
      searchQuerySet: prisma.searchQuerySet,
    }),
    buildHermesLinks(row.id, {
      contentGenerationRun: prisma.contentGenerationRun,
      deliveryRun: prisma.deliveryRun,
    }),
    renderEmailPreview(
      {
        newsletterId: row.id,
        subject: row.subject,
        bodyText: row.content,
        tickerSymbol: row.ticker.symbol,
      },
      { logger },
    ),
  ]);

  for (const entry of recipientsResult.notAttemptedAtSendTime) {
    logger.warn(
      {
        newsletterId: row.id,
        userTickerId: entry.userTickerId,
        runId: entry.runId,
      },
      "Enabled subscriber resolved to not_attempted for newsletter",
    );
  }
  for (const userTickerId of recipientsResult.inconsistentUserTickerIds) {
    logger.warn(
      {
        newsletterId: row.id,
        userTickerId,
        runId: hermesLinks.deliveryRunIds[0] ?? null,
      },
      "Newsletter recipient outcome=success without checkpoint (inconsistent)",
    );
  }

  return c.json(
    mapRowToDetailItem(row, {
      emailPreviewHtml,
      citedArticles,
      sourceCollection,
      recipients: recipientsResult.recipients,
      recipientsTruncated: recipientsResult.truncated,
      recipientsCap: NEWSLETTER_DETAIL_RECIPIENTS_CAP,
      recipientsTotalCount: recipientsResult.totalCount,
      recipientsDeliveredCount: recipientsResult.deliveredCount,
      recipientsEnabledAtSendTime: recipientsResult.enabledAtSendTime,
      activeQuerySet,
      hermesLinks,
    }),
  );
});

registerTableV1CustomActionRoutes(
  newslettersRoutes,
  newslettersTableV1CustomActionRegistrations,
);
