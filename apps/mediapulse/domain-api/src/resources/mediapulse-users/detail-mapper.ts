/**
 * Maps a `MediapulseUser` row with subscriptions to the detail payload for the Hermes table API.
 */

import type { Prisma } from "@mediapulse/database";

import { formatLanguageLabel } from "./list-mapper";

/** Prisma row shape for detail queries that include ticker subscriptions. */
export type MediapulseUserDetailRow = Prisma.MediapulseUserGetPayload<{
  include: {
    userTickers: {
      include: { ticker: { select: { symbol: true; name: true } } };
    };
  };
}>;

/** One subscription row in the Hermes detail sub-table. */
export type SubscriptionRow = {
  tickerSymbol: string;
  tickerName: string;
  language: string;
  enabled: string;
  registrationConfirmedAt: string | null;
  unsubscribedAt: string | null;
  unsubscribeMethod: string;
};

/** Shape of the detail payload exposed by `GET /mediapulse-users/:id`. */
export type DetailItem = {
  id: string;
  email: string;
  name: string | null;
  enabled: string;
  createdAt: string;
  updatedAt: string;
  subscriptions: SubscriptionRow[];
};

/**
 * Formats a nullable date for the detail sub-table.
 *
 * @param value - Date from Prisma, or null when unset.
 * @returns ISO string, or null when absent.
 */
export const formatDetailDateTime = (value: Date | null): string | null =>
  value?.toISOString() ?? null;

/**
 * Formats the unsubscribe method for display, or an em dash when absent.
 *
 * @param value - Raw `unsubscribeMethod` from Prisma.
 * @returns Display string for the detail sub-table.
 */
export const formatUnsubscribeMethod = (value: string | null): string =>
  value ?? "—";

/**
 * Maps one `UserTicker` row to a subscription sub-table row.
 *
 * @param subscription - User subscription with ticker joined from Prisma.
 * @returns Serializable subscription row for the Hermes dashboard.
 */
export const mapSubscriptionToDetailRow = (
  subscription: MediapulseUserDetailRow["userTickers"][number],
): SubscriptionRow => ({
  tickerSymbol: subscription.ticker.symbol,
  tickerName: subscription.ticker.name,
  language: formatLanguageLabel(subscription.language),
  enabled: subscription.enabled ? "Yes" : "No",
  registrationConfirmedAt: formatDetailDateTime(
    subscription.registrationConfirmedAt,
  ),
  unsubscribedAt: formatDetailDateTime(subscription.unsubscribedAt),
  unsubscribeMethod: formatUnsubscribeMethod(subscription.unsubscribeMethod),
});

/**
 * Maps a Prisma Mediapulse user row to the detail response.
 *
 * @param row - Row from `prisma.mediapulseUser.findUnique` with subscriptions included.
 * @returns Detail item for the Hermes dashboard.
 */
export const mapRowToDetailItem = (
  row: MediapulseUserDetailRow,
): DetailItem => ({
  id: row.id,
  email: row.email,
  name: row.name,
  enabled: row.enabled ? "Yes" : "No",
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  subscriptions: row.userTickers.map(mapSubscriptionToDetailRow),
});
