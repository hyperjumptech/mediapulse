/** Slim ticker representation used throughout the app. */
export type Ticker = {
  KodeEmiten: string;
  NamaEmiten: string;
};

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
 * @returns Encoded mailto: URL string targeting mediapulse@hyperjump.tech.
 */
export const buildMailtoUrl = (ticker: Ticker): string => {
  const subject = `[MediaPulse] Newsletter Subscription - ${ticker.KodeEmiten}`;

  const body = [
    `Ticker: ${ticker.KodeEmiten} - ${ticker.NamaEmiten}`,
    ``,
    `---`,
    `Please do not modify the subject or content of this email before sending.`,
  ].join("\n");

  return `mailto:mediapulse@hyperjump.tech?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};
