import type { GraphMessage } from "@mediapulse/outlook-inbox";

/** Same shape as extractSenderEmail validation (reject if "display name" is an email string). */
const EMAIL_SHAPE_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Converts Graph message body content (plain text or HTML) into newline-oriented text for line-based field parsing.
 *
 * @param content - Raw `body.content` from Microsoft Graph (may be HTML).
 * @returns Plain-ish text with meaningful newlines, or empty string when missing.
 */
function normalizeGraphBodyContentForLineParsing(
  content: string | null | undefined,
): string {
  if (!content || typeof content !== "string") return "";
  let text = content.trim();
  if (!text) return "";

  const looksLikeHtml = /<\s*[a-z][\s\S]*>/i.test(text);
  if (!looksLikeHtml) return text;

  text = text
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|tr|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

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

/**
 * Returns Graph `from.emailAddress.name` when it is a plausible human display name
 * (not empty, not the same as the sender email, not itself an email address).
 *
 * @param fromName - Optional display name from Graph.
 * @param normalizedSenderEmail - Already-normalized sender address for comparison.
 * @returns Trimmed display name or null.
 */
export function extractUsableFromDisplayName(
  fromName: string | null | undefined,
  normalizedSenderEmail: string,
): string | null {
  if (!fromName || typeof fromName !== "string") return null;
  const trimmed = fromName.trim();
  if (trimmed.length < 2) return null;
  if (normalizeEmail(trimmed) === normalizedSenderEmail) return null;
  if (EMAIL_SHAPE_REGEX.test(normalizeEmail(trimmed))) return null;
  return trimmed;
}

/**
 * Extracts subscriber display name from the message body.
 * Prefers a `Name:` line, then `Subscriber Name:` (legacy mailto), then legacy one-line bodies.
 *
 * @param bodyContent - Optional `body.content` from Graph (plain or HTML).
 * @returns Trimmed name or null when absent.
 */
export function extractSubscriberName(
  bodyContent?: string | null,
): string | null {
  const normalized = normalizeGraphBodyContentForLineParsing(bodyContent);
  if (!normalized) return null;

  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    const nameLine = line.match(/^Name:\s*(.+)$/i);
    if (nameLine?.[1]) {
      const value = nameLine[1].trim();
      if (value.length > 0) return value;
    }
  }

  for (const line of lines) {
    const legacyLine = line.match(/^Subscriber Name:\s*(.+)$/i);
    if (legacyLine?.[1]) {
      const value = legacyLine[1].trim();
      if (value.length > 0) return value;
    }
  }

  const legacyInline = normalized.match(
    /Subscriber Name:\s*(.+?)(?=\s+---|\s*$)/is,
  );
  if (legacyInline?.[1]) {
    const value = legacyInline[1].trim();
    if (value.length > 0) return value;
  }

  const nameInline = normalized.match(
    /Name:[ \t]*([^\n]+?)(?=(?:\s+|\n)Ticker:|\s+Subscriber|\s+---|\s*$)/i,
  );
  if (nameInline?.[1]) {
    const value = nameInline[1].trim();
    if (value.length > 0) return value;
  }

  return null;
}

/**
 * Resolves the display name to send to user-registration-register: body `Name:` / legacy lines first,
 * then Graph sender display name, then title-cased local part of the email.
 *
 * @param graphMessage - Full Graph message (from + body).
 * @param senderEmail - Normalized sender email from {@link extractSenderEmail}.
 * @returns Display name or null if no source produced a value.
 */
export function resolveSubscriberDisplayName(
  graphMessage: GraphMessage,
  senderEmail: string,
): string | null {
  const fromBody = extractSubscriberName(graphMessage.body?.content);
  if (fromBody) return fromBody;

  const fromHeader = extractUsableFromDisplayName(
    graphMessage.from?.emailAddress?.name,
    senderEmail,
  );
  if (fromHeader) return fromHeader;

  return deriveNameFromEmailLocalPart(senderEmail);
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
