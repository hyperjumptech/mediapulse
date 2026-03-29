export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeTickerSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

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

export function extractSenderEmail(graphMessage: any): string | null {
  if (!graphMessage || typeof graphMessage !== "object") return null;

  // Usually graphMessage.sender.emailAddress.address or graphMessage.from.emailAddress.address
  const fromEmail = graphMessage.from?.emailAddress?.address;
  const senderEmail = graphMessage.sender?.emailAddress?.address;

  const extracted = fromEmail || senderEmail;
  if (!extracted || typeof extracted !== "string") return null;

  return normalizeEmail(extracted);
}

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
