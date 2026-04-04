import type { GraphMessage } from "@mediapulse/outlook-inbox";

/** Normalizes an email address to trimmed lowercase. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Normalizes a ticker symbol to trimmed uppercase. */
export function normalizeTickerSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

/**
 * Derives a display name from the local part of an email address.
 * Splits on dots, underscores, and dashes, then title-cases the result.
 * Returns null if a name cannot be derived.
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
 * Extracts a normalized ticker symbol from an email subject or body.
 * Primary: matches "Newsletter Subscription - {SYMBOL}" in the subject.
 * Fallback: matches "Ticker: {SYMBOL}" line in the body.
 * Returns null if no valid ticker can be extracted.
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
