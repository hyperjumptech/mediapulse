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

/** Spaced pipe segments keep mailto bodies readable when clients (e.g. Gmail app) flatten newlines. */
export const MAILTO_BODY_SECTION_SEPARATOR = "  |  ";

/** Newsletter delivery language a subscriber can choose (`en` = English, `id` = Indonesian). */
export type RegistrationLanguage = "en" | "id";

/** Human-readable labels for the language selector, ordered for display (English first). */
export const REGISTRATION_LANGUAGE_OPTIONS: ReadonlyArray<{
  value: RegistrationLanguage;
  label: string;
}> = [
  { value: "en", label: "English" },
  { value: "id", label: "Indonesian" },
];

/**
 * Builds a mailto URL for newsletter subscription with a fixed subject and body.
 * The subscriber's address comes from the mail client's From field when they send.
 * Display name is included as `Name:` and the chosen language as `Language:` for the agent
 * to parse. Sections are joined with spaced pipes so Gmail and similar clients still show
 * separation when the draft is one line.
 *
 * @param ticker - Ticker the user wants to subscribe to.
 * @param name - Subscriber display name (included in the body for processing).
 * @param language - Preferred newsletter language code (included in the body for processing).
 * @param registrationEmail - The target email address for registration (defaults to mediapulse@hyperjump.tech).
 * @returns Encoded mailto: URL string.
 */
export const buildMailtoUrl = (
  ticker: Ticker,
  name: string,
  language: RegistrationLanguage,
  registrationEmail: string = "mediapulse@hyperjump.tech",
): string => {
  const subject = `[MediaPulse] Newsletter Subscription - ${ticker.KodeEmiten}`;

  const body = [
    `Name: ${name.trim()}`,
    `Ticker: ${ticker.KodeEmiten}`,
    `Language: ${language}`,
    "---",
    "Please do not modify the subject or content of this email before sending.",
  ].join(MAILTO_BODY_SECTION_SEPARATOR);

  return `mailto:${registrationEmail}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
};
