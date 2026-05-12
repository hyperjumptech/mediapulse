import { z } from "zod";

/** Zod schema for a slim ticker row (symbol as `KodeEmiten`, name as `NamaEmiten`). */
export const tickerSchema = z.object({
  KodeEmiten: z.string(),
  NamaEmiten: z.string(),
});

/** Slim ticker representation used throughout the app. */
export type Ticker = z.infer<typeof tickerSchema>;

/** Zod schema for the full ticker list returned to the registration UI. */
export const tickersArraySchema = z.array(tickerSchema);

/**
 * Filters tickers by matching the query against both code and name.
 * @param tickers - Full list of available tickers.
 * @param query - Search string (case-insensitive, trimmed).
 * @returns Tickers where code or name contains the query.
 */
export const filterTickers = (tickers: Ticker[], query: string): Ticker[] => {
  const q = query.toLowerCase().trim();

  if (!q) return tickers;

  return tickers.filter(
    (t) =>
      t.KodeEmiten.toLowerCase().includes(q) ||
      t.NamaEmiten.toLowerCase().includes(q),
  );
};

/**
 * Formats a ticker as a human-readable display string.
 * @param ticker - The selected ticker.
 * @returns Display string like "BBCA - Bank Central Asia Tbk".
 */
export const formatTicker = (ticker: Ticker): string =>
  `${ticker.KodeEmiten} - ${ticker.NamaEmiten}`;

/**
 * Builds a mailto URL for newsletter subscription with a fixed subject and body.
 * The subscriber's address comes from the mail client's From field when they send.
 * Display name is included in the body as `Name:` for the registration agent to parse.
 *
 * @param ticker - Ticker the user wants to subscribe to.
 * @param name - Subscriber display name (included in the body for processing).
 * @param registrationEmail - The target email address for registration (defaults to mediapulse@hyperjump.tech).
 * @returns Encoded mailto: URL string.
 */
export const buildMailtoUrl = (
  ticker: Ticker,
  name: string,
  registrationEmail: string = "mediapulse@hyperjump.tech",
): string => {
  const subject = `[MediaPulse] Newsletter Subscription - ${ticker.KodeEmiten}`;

  const bodyLines = [
    `Name: ${name.trim()}`,
    `Ticker: ${ticker.KodeEmiten}`,
    "",
    "---",
    "Please do not modify the subject or content of this email before sending.",
  ];

  const body = bodyLines.join("\n");

  return `mailto:${registrationEmail}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
};
