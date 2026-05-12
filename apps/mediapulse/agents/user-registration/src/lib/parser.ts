import type { GraphMessage } from "@mediapulse/outlook-inbox";

/**
 * Normalizes an email address to trimmed lowercase.
 *
 * @param {string} email - The email address to normalize.
 * @returns {string} The normalized email address.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalizes a ticker symbol to trimmed uppercase.
 *
 * @param {string} symbol - The ticker symbol to normalize.
 * @returns {string} The normalized ticker symbol.
 */
export function normalizeTickerSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

/**
 * Derives a display name from the local part of an email address.
 * Splits on dots, underscores, and dashes, then title-cases the result.
 * Returns null if a name cannot be derived.
 *
 * @param {string} email - The email address to derive the name from.
 * @returns {string | null} The derived name or null.
 */
export function deriveNameFromEmailLocalPart(email: string): string | null {
  if (!email) return null;
  const parts = email.split("@");
  if (parts.length < 2) return null;
  const localPart = parts[0];
  if (!localPart) return null;

  // Clean up typical local parts to derive a basic name
  // Replace dots, underscores, and dashes with spaces, and capitalize words.
  const cleaned = localPart.replace(/[._-]/g, " ");
  const titleCased = cleaned.replace(/\b\w/g, (c) => c.toUpperCase()).trim();

  return titleCased.length > 0 ? titleCased : null;
}

/**
 * Extracts and normalizes the sender email address from a Graph API message.
 * Uses the `from.emailAddress.address` field. Returns null if absent or invalid.
 *
 * @param {GraphMessage} graphMessage - The Graph API message object.
 * @returns {string | null} The extracted email or null.
 */
export function extractSenderEmail(graphMessage: GraphMessage): string | null {
  const fromEmail = graphMessage.from?.emailAddress?.address;
  if (!fromEmail || typeof fromEmail !== "string") return null;

  const normalized = normalizeEmail(fromEmail);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalized)) {
    return null;
  }

  return normalized;
}

const MAX_SUBSCRIBER_NAME_LENGTH = 500;

/**
 * Normalizes Graph message body to plain text with line breaks for structured parsing.
 *
 * @param body - Raw body (plain text or HTML from Microsoft Graph).
 * @returns Approximate plain text.
 */
function graphBodyApproxPlainText(body: string): string {
  if (!body.includes("<")) {
    return body;
  }

  return body
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Extracts the subscriber display name from the registration mailto body.
 * The registration app emits `Subscriber Name:` (the `Name:` segment of that label).
 * The value runs until the next boundary: spaced pipe segments (`  |  `) from the web
 * mailto, a later `Ticker:`, the `---` separator (after optional newlines), the
 * “Please do not modify” disclaimer, or end of text.
 *
 * @param body - Message body content (plain or HTML).
 * @returns Trimmed name or null when the label is missing or empty.
 */
export function extractSubscriberNameFromBody(
  body?: string | null,
): string | null {
  if (!body || typeof body !== "string") return null;

  const text = graphBodyApproxPlainText(body).trim();
  if (!text) return null;

  const m = text.match(
    /Subscriber Name:\s*(.+?)(?=\s+\|\s+|[\r\n]+\s*---|\s*---|\s*Ticker:|\s*Please do not modify|$)/is,
  );
  if (!m?.[1]) return null;

  const trimmed = m[1].replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_SUBSCRIBER_NAME_LENGTH
    ? trimmed.slice(0, MAX_SUBSCRIBER_NAME_LENGTH).trim()
    : trimmed;
}

/**
 * Extracts a normalized ticker symbol from an email subject or body.
 * Primary: matches "Newsletter Subscription - {SYMBOL}" in the subject.
 * Fallback: matches "Ticker: {SYMBOL}" line in the body.
 * Returns null if no valid ticker can be extracted.
 *
 * @param {string | null} subject - The email subject.
 * @param {string | null} body - The email body content.
 * @returns {string | null} The extracted ticker symbol or null.
 */
export function extractTickerSymbol(
  subject?: string | null,
  body?: string | null,
): string | null {
  // 1. Primary extraction from subject: [MediaPulse] Newsletter Subscription - {KodeEmiten}
  if (subject) {
    const subjectMatch = subject.match(
      /Newsletter Subscription\s*-\s*([A-Za-z0-9]+)/i,
    );
    if (subjectMatch && subjectMatch[1]) {
      return normalizeTickerSymbol(subjectMatch[1]);
    }
  }

  // 2. Fallback extraction from body line: Ticker: {KodeEmiten} - {NamaEmiten}
  if (body) {
    const bodyLines = body.split(/\r?\n/);
    for (const line of bodyLines) {
      const lineMatch = line.match(/^Ticker:\s*([A-Za-z0-9]+)(\s*-|$)/i);
      if (lineMatch && lineMatch[1]) {
        return normalizeTickerSymbol(lineMatch[1]);
      }
    }

    // Looser fallback if `Ticker:` prefix was somewhat altered
    const looseBodyMatch = body.match(/Ticker\s*[:\-]?\s*([A-Za-z0-9]+)/i);
    if (looseBodyMatch && looseBodyMatch[1]) {
      return normalizeTickerSymbol(looseBodyMatch[1]);
    }
  }

  return null;
}
