import { parseNewsletterEmailSubject } from "@workspace/email-templates/newsletter-email-subject";
import {
  newsletterDocumentSchema,
  readNewsletterDocument,
  renderNewsletterEmail,
} from "@workspace/email-templates";

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
  language?: "en" | "id";
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
    language: "en" | "id";
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
 * Shown instead of the rendered email when a newsletter predates the JSON document
 * format. Those bodies are plain wire text, and rendering them would dump raw
 * `MP_NEWSLETTER` markers into the dashboard.
 */
const LEGACY_FORMAT_NOTICE =
  "<p>This newsletter was generated before the current content format and cannot be previewed. Its delivered email is unaffected.</p>";

/**
 * Shown when the body parses as JSON but breaks the document schema. This is a real
 * defect rather than an old format, so the notice names the failing fields: delivery
 * skips a recipient whose body lands here.
 */
const buildInvalidDocumentNotice = (issues: readonly string[]): string =>
  [
    "<p>This body is not a valid newsletter document, so it cannot be previewed and will not be delivered.</p>",
    "<ul>",
    ...issues.map((issue) => `<li>${escapeHtml(issue)}</li>`),
    "</ul>",
  ].join("");

const describeBodyFailure = (
  bodyText: string,
): { kind: "legacy" } | { kind: "invalid"; issues: string[] } => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return { kind: "legacy" };
  }

  const result = newsletterDocumentSchema.safeParse(parsed);
  if (result.success) {
    return { kind: "legacy" };
  }

  return {
    kind: "invalid",
    issues: result.error.issues.map(
      (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
    ),
  };
};

/**
 * Renders the production `default-newsletter` React Email template for the
 * given newsletter and returns the HTML string for the `htmlPreview` block.
 *
 * A body that is not a valid newsletter document predates this format and returns a
 * short notice rather than a dump of raw wire text.
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
    (async ({ title, bodyText, tickerSymbol, unsubscribeUrl, language }) => {
      const result = await renderNewsletterEmail({
        title,
        bodyText,
        tickerSymbol,
        unsubscribeUrl,
        language,
        variant: "default",
      });
      return { html: result.html };
    });

  if (readNewsletterDocument(input.bodyText) === undefined) {
    const failure = describeBodyFailure(input.bodyText);
    if (failure.kind === "legacy") {
      return LEGACY_FORMAT_NOTICE;
    }
    deps.logger?.warn(
      { newsletterId: input.newsletterId, issues: failure.issues },
      "Newsletter body failed document validation",
    );

    return buildInvalidDocumentNotice(failure.issues);
  }

  try {
    const emailTitle = parseNewsletterEmailSubject(input.subject).title;
    const { html } = await renderHtml({
      title: emailTitle,
      bodyText: input.bodyText,
      tickerSymbol: input.tickerSymbol,
      unsubscribeUrl: PREVIEW_UNSUBSCRIBE_URL,
      language: input.language ?? "en",
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
