import type { Prisma } from "@mediapulse/database";

/** Row shape for newsletter list (joined ticker). */
export type NewsletterListRow = Prisma.NewsletterGetPayload<{
  include: { ticker: { select: { symbol: true; name: true } } };
}>;

/**
 * Aggregate of delivery stats for one newsletter. The `deliveryHasRun` flag tells
 * the list cell whether to render "(no run yet)" or the badge.
 */
export type NewsletterDeliveryAggregate = {
  deliveryDelivered: number;
  deliveryEnabledAtSendTime: number;
  deliveryHasRun: boolean;
};

/** Shape of one row in the newsletters list table. */
export type ListItem = {
  id: string;
  subject: string;
  tickerId: string;
  tickerSymbol: string;
  tickerName: string;
  createdAt: string;
  deliveryDelivered: number;
  deliveryEnabledAtSendTime: number;
  deliveryHasRun: boolean;
};

export const listInclude = {
  ticker: { select: { symbol: true, name: true } },
} satisfies Prisma.NewsletterInclude;

/**
 * Maps a Prisma newsletter row plus a delivery aggregate to a table-v1 list item.
 *
 * @param row - Newsletter row with the joined ticker.
 * @param aggregate - Delivery aggregate from {@link buildDeliveryAggregateMap}.
 * @returns List item for the Hermes dashboard.
 */
export function mapRowToListItem(
  row: NewsletterListRow,
  aggregate: NewsletterDeliveryAggregate,
): ListItem {
  return {
    id: row.id,
    subject: row.subject,
    tickerId: row.tickerId,
    tickerSymbol: row.ticker.symbol,
    tickerName: row.ticker.name,
    createdAt: row.createdAt.toISOString(),
    deliveryDelivered: aggregate.deliveryDelivered,
    deliveryEnabledAtSendTime: aggregate.deliveryEnabledAtSendTime,
    deliveryHasRun: aggregate.deliveryHasRun,
  };
}
