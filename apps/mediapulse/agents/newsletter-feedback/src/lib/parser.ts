import type { GraphMessage } from "@mediapulse/outlook-inbox";

/**
 * Normalizes an email address to trimmed lowercase.
 *
 * @param email - The email address to normalize.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Extracts and normalizes the sender email from a Graph message, or null when
 * absent or not a valid address.
 *
 * @param graphMessage - The Graph API message object.
 */
export function extractSenderEmail(graphMessage: GraphMessage): string | null {
  const fromEmail = graphMessage.from?.emailAddress?.address;
  if (!fromEmail || typeof fromEmail !== "string") {
    return null;
  }

  const normalized = normalizeEmail(fromEmail);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalized)) {
    return null;
  }

  return normalized;
}

/**
 * Reads a named internet message header from a Graph message (case-insensitive).
 *
 * @param graphMessage - The Graph API message object.
 * @param headerName - Header to look up (e.g. `In-Reply-To`).
 * @returns The header value, or null when the header is absent.
 */
export function getInternetMessageHeader(
  graphMessage: GraphMessage,
  headerName: string,
): string | null {
  const headers = graphMessage.internetMessageHeaders;
  if (!headers) {
    return null;
  }
  const target = headerName.toLowerCase();
  for (const header of headers) {
    if (header.name?.toLowerCase() === target && header.value) {
      return header.value;
    }
  }

  return null;
}

/**
 * Resolves the Message-ID this reply is responding to, preferring `In-Reply-To`
 * and falling back to the last id in `References`.
 *
 * @param graphMessage - The Graph API message object.
 * @returns The referenced Message-ID, or null when none is present.
 */
export function extractInReplyToMessageId(
  graphMessage: GraphMessage,
): string | null {
  const inReplyTo = getInternetMessageHeader(graphMessage, "In-Reply-To");
  if (inReplyTo) {
    return inReplyTo.trim();
  }

  const references = getInternetMessageHeader(graphMessage, "References");
  if (references) {
    const ids = references.trim().split(/\s+/);
    const last = ids[ids.length - 1];

    return last ?? null;
  }

  return null;
}

/**
 * Self-describing newsletter Message-ID set by the delivery agent:
 * `<nl.{newsletterId}.{userTickerId}@domain>`. A reply whose `In-Reply-To`
 * carries this shape is one of our newsletters; anything else is registration
 * mail or unrelated human correspondence sharing the mailbox.
 */
const SELF_DESCRIBING_MESSAGE_ID = /<nl\.[0-9a-f-]{36}\.[0-9a-f-]{36}@/i;

/**
 * Returns true when the referenced Message-ID identifies one of our delivered
 * newsletters, i.e. the message is a genuine newsletter reply.
 *
 * @param inReplyToMessageId - Value from {@link extractInReplyToMessageId}.
 */
export function isNewsletterReply(
  inReplyToMessageId: string | null | undefined,
): boolean {
  if (!inReplyToMessageId) {
    return false;
  }

  return SELF_DESCRIBING_MESSAGE_ID.test(inReplyToMessageId);
}

/**
 * Converts Graph message body content (plain text or HTML) into newline-oriented
 * plain text.
 *
 * @param content - Raw `body.content` from Microsoft Graph (may be HTML).
 * @returns Plain-ish text with meaningful newlines, or empty string when missing.
 */
export function normalizeGraphBodyContentForLineParsing(
  content: string | null | undefined,
): string {
  if (!content || typeof content !== "string") {
    return "";
  }
  let text = content.trim();
  if (!text) {
    return "";
  }

  const looksLikeHtml = /<\s*[a-z][\s\S]*>/i.test(text);
  if (!looksLikeHtml) {
    return text;
  }

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

/** Markers that begin the quoted original message in a reply. */
const QUOTED_REPLY_BOUNDARIES = [
  /^-{2,}\s*original message\s*-{2,}/im,
  /^_{5,}/m,
  /^from:\s.+$/im,
  /^on\s.+\swrote:\s*$/im,
  /^sent from my /im,
];

/**
 * Returns the author's own text from a reply by dropping the quoted original
 * message and `>`-quoted lines. The full raw body is stored separately; this is
 * only used to focus the classifier on what the person actually wrote.
 *
 * @param bodyContent - Raw `body.content` from Graph (plain or HTML).
 */
export function stripQuotedReply(bodyContent?: string | null): string {
  const normalized = normalizeGraphBodyContentForLineParsing(bodyContent);
  if (!normalized) {
    return "";
  }

  let cutIndex = normalized.length;
  for (const boundary of QUOTED_REPLY_BOUNDARIES) {
    const match = boundary.exec(normalized);
    if (match && match.index < cutIndex) {
      cutIndex = match.index;
    }
  }

  const topPortion = normalized.slice(0, cutIndex);

  return topPortion
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n")
    .trim();
}
