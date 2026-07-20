import {
  readNewsletterDocument,
  type NewsletterDocument,
} from "./newsletter-document.js";

/**
 * Reads a newsletter body into a validated document.
 *
 * A body that is not a valid document yields `undefined`, and the renderer falls back to
 * plain-text rendering. This is the only structured body format; the executive-summary
 * digest and the `MP_NEWSLETTER` wire format are both gone.
 *
 * @param bodyText - Raw `Newsletter.content` string.
 * @returns The document, or `undefined` when the body is not one.
 */
export function parseNewsletterBody(
  bodyText: string,
): NewsletterDocument | undefined {
  return readNewsletterDocument(bodyText);
}
