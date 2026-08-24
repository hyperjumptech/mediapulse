/** Parsed newsletter email subject: ticker prefix and plain headline. */
export type ParsedNewsletterEmailSubject = {
  tickerSymbol: string | null;
  title: string;
};

const NEWSLETTER_EMAIL_SUBJECT_PATTERN = /^([A-Za-z0-9]+)\s+Pulse:\s+(.+)$/;

const LEGACY_BRACKET_NEWSLETTER_EMAIL_SUBJECT_PATTERN =
  /^\[([^\]]+)\]\s+Pulse:\s+(.+)$/;

/**
 * Formats a newsletter inbox subject as `TICKER Pulse: title`.
 * Idempotent when the subject is already formatted (including legacy bracket form).
 *
 * @param tickerSymbol - Exchange symbol (uppercased in output).
 * @param title - Plain headline without the Pulse prefix.
 * @returns Formatted subject, or trimmed title when symbol is missing.
 */
export const formatNewsletterEmailSubject = (
  tickerSymbol: string,
  title: string,
): string => {
  const trimmedTitle = title.trim();
  const symbol = tickerSymbol.trim().toUpperCase();

  if (trimmedTitle.length === 0) {
    return symbol.length > 0
      ? `${symbol} Pulse: Today's issue`
      : "Today's issue";
  }

  const parsed = parseNewsletterEmailSubject(trimmedTitle);
  if (parsed.tickerSymbol !== null) {
    return `${parsed.tickerSymbol} Pulse: ${parsed.title}`;
  }

  if (symbol.length === 0) {
    return trimmedTitle;
  }

  return `${symbol} Pulse: ${trimmedTitle}`;
};

/**
 * Parses a stored newsletter subject into ticker symbol and plain title.
 * Supports `TICKER Pulse: title` and legacy `[TICKER] Pulse: title` rows.
 * Plain legacy subjects without the Pulse prefix return `tickerSymbol: null`.
 *
 * @param subject - Stored or rendered newsletter subject line.
 * @returns Ticker symbol (when prefixed) and plain headline title.
 */
export const parseNewsletterEmailSubject = (
  subject: string,
): ParsedNewsletterEmailSubject => {
  const trimmed = subject.trim();
  const match =
    NEWSLETTER_EMAIL_SUBJECT_PATTERN.exec(trimmed) ??
    LEGACY_BRACKET_NEWSLETTER_EMAIL_SUBJECT_PATTERN.exec(trimmed);

  if (match === null) {
    return { tickerSymbol: null, title: trimmed };
  }

  return {
    tickerSymbol: match[1]!.trim().toUpperCase(),
    title: match[2]!.trim(),
  };
};
