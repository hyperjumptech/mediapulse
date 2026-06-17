import { parseNewsletterEmailSubject } from "@workspace/email-templates/newsletter-email-subject";
import { renderNewsletterEmail } from "@workspace/email-templates";

import type { Logger } from "@workspace/logger";

/**
 * Input for {@link renderEmailPreview} — only the fields needed by the
 * `default-newsletter` template. The preview never sends emails, so we omit
 * per-recipient tokens; `unsubscribeUrl` is a deterministic placeholder so the
 * rendered HTML is stable across invocations.
 */
export type RenderEmailPreviewInput = {
  newsletterId: string;
  subject: string;
  bodyText: string;
  tickerSymbol: string;
};

/**
 * Render dependency injection — tests stub `renderHtml` to assert behavior
 * without spinning up React Email.
 */
export type RenderEmailPreviewDeps = {
  /** Async HTML renderer; defaults to `@workspace/email-templates` `renderNewsletterEmail`. */
  renderHtml?: (input: {
    title: string;
    bodyText: string;
    tickerSymbol: string;
    unsubscribeUrl: string;
  }) => Promise<{ html: string }>;
  /** Pino-compatible logger; defaults to a no-op. */
  logger?: Pick<Logger, "warn"> | { warn: (...args: unknown[]) => void };
};

/**
 * Placeholder unsubscribe URL used by the preview render. The detail page
 * never sends mail, so the link is informational only — the deterministic
 * value also keeps the rendered HTML byte-stable for the same input.
 */
const PREVIEW_UNSUBSCRIBE_URL = "https://example.com/preview/unsubscribe";

/**
 * Renders the production `default-newsletter` React Email template for the
 * given newsletter and returns the HTML string for the `htmlPreview` block.
 *
 * Rendering failures do not propagate: the function returns a tiny safe
 * placeholder paragraph and logs a structured warning that does not contain
 * subscriber data. The detail handler can therefore always respond 200 even
 * when the template throws.
 *
 * @param input - Subject, body, ticker symbol, and newsletter id.
 * @param deps - Optional `renderHtml` override and `logger`.
 * @returns Rendered HTML string (real preview or placeholder).
 */
export const renderEmailPreview = async (
  input: RenderEmailPreviewInput,
  deps: RenderEmailPreviewDeps = {},
): Promise<string> => {
  const renderHtml =
    deps.renderHtml ??
    (async ({ title, bodyText, tickerSymbol, unsubscribeUrl }) => {
      const result = await renderNewsletterEmail({
        title,
        bodyText,
        tickerSymbol,
        unsubscribeUrl,
        variant: "default",
      });
      return { html: result.html };
    });

  try {
    const emailTitle = parseNewsletterEmailSubject(input.subject).title;
    const { html } = await renderHtml({
      title: emailTitle,
      bodyText: input.bodyText,
      tickerSymbol: input.tickerSymbol,
      unsubscribeUrl: PREVIEW_UNSUBSCRIBE_URL,
    });
    return html;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deps.logger?.warn(
      { newsletterId: input.newsletterId, error: message },
      "Failed to render newsletter email preview",
    );
    return `<p>Email preview unavailable: ${escapeHtml(message)}</p>`;
  }
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
