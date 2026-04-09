import { z } from "zod";

/** Zod schema for a slim ticker from tickers.json. */
export const tickerSchema = z.object({
  KodeEmiten: z.string(),
  NamaEmiten: z.string(),
});

/** Slim ticker representation used throughout the app. */
export type Ticker = z.infer<typeof tickerSchema>;

/** Zod schema for tickers.json array. */
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
 * @param ticker - Ticker the user wants to subscribe to.
 * @param name - Name of the user (optional).
 * @param email - Email of the user.
 * @param registrationEmail - The recipient address from env (injectable for testing).
 * @returns Encoded mailto: URL string.
 */
export const buildMailtoUrl = (
  ticker: Ticker,
  name: string,
  email: string,
  registrationEmail: string,
): string => {
  const subject = `[MediaPulse] Newsletter Subscription - ${ticker.KodeEmiten}`;

  const body = [
    `I would like to subscribe to updates for ${ticker.KodeEmiten} - ${ticker.NamaEmiten}.`,
    ``,
    `Name: ${name || "Not provided"}`,
    `Email: ${email}`,
    `Reference: ${Date.now()}`,
    ``,
    `---`,
    `Please do not modify the subject or content of this email before sending.`,
  ].join("\n");

  return `mailto:${registrationEmail}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
};
