import { render } from "@react-email/render";
import type { ReactElement } from "react";

import { DefaultNewsletterEmail } from "./newsletter/default-newsletter.js";
import type { DefaultNewsletterEmailProps } from "./newsletter/default-newsletter.js";
import RegistrationConfirmationEmail from "./registration/registration-confirmation.js";
import type { RegistrationConfirmationEmailProps } from "./registration/registration-confirmation.js";
import RegistrationPendingConfirmationEmail from "./registration/registration-pending-confirmation.js";
import type { RegistrationPendingConfirmationEmailProps } from "./registration/registration-pending-confirmation.js";
import InvalidTickerEmail from "./registration/invalid-ticker.js";
import type { InvalidTickerEmailProps } from "./registration/invalid-ticker.js";

/** Supported newsletter template variants for rendering. */
export type NewsletterTemplateVariant =
  | "default"
  | "registration-confirmation"
  | "registration-pending-confirmation"
  | "invalid-ticker";

export type RenderNewsletterEmailInput =
  | ({ variant?: "default" } & DefaultNewsletterEmailProps & {
        unsubscribeUrl?: string;
        tickerSymbol?: string;
        mediapulseSiteUrl?: string;
        hyperjumpSiteUrl?: string;
        language?: "en" | "id";
      })
  | ({
      variant: "registration-confirmation";
      nextDeliveryLabel?: string;
    } & RegistrationConfirmationEmailProps)
  | ({
      variant: "registration-pending-confirmation";
    } & RegistrationPendingConfirmationEmailProps)
  | ({ variant: "invalid-ticker" } & InvalidTickerEmailProps);

type RenderEmailToHtml = (element: ReactElement) => Promise<string>;
type RenderEmailToText = (element: ReactElement) => Promise<string>;

export type RenderNewsletterEmailDependencies = {
  renderHtml?: RenderEmailToHtml;
  renderText?: RenderEmailToText;
  fallbackRenderHtml?: (element: ReactElement) => string;
};

/**
 * Returns true when the renderer failed due to missing ReactDOM server stream support.
 *
 * @param error - Unknown render error.
 * @returns True when fallback rendering should be used.
 */
const shouldUseStaticFallbackRenderer = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("renderToReadableStream");
};

/**
 * Converts rendered HTML into a safe plain-text approximation for text-only delivery.
 *
 * @param html - Rendered email HTML.
 * @returns Plain text extracted from the HTML.
 */
const htmlToPlainText = (html: string): string => {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Selects the React Email root element for the given variant.
 *
 * @param input - Template variant and its required props.
 * @returns React element tree to render.
 */
function newsletterElementForVariant(
  input: RenderNewsletterEmailInput,
): ReactElement {
  switch (input.variant) {
    case undefined:
    case "default":
      return (
        <DefaultNewsletterEmail
          title={input.title}
          bodyText={input.bodyText}
          footerNote={input.footerNote}
          unsubscribeUrl={input.unsubscribeUrl}
          tickerSymbol={input.tickerSymbol}
          mediapulseSiteUrl={input.mediapulseSiteUrl}
          hyperjumpSiteUrl={input.hyperjumpSiteUrl}
          language={input.language}
        />
      );
    case "registration-confirmation":
      return (
        <RegistrationConfirmationEmail
          tickerSymbol={input.tickerSymbol}
          nextDeliveryLabel={input.nextDeliveryLabel}
        />
      );
    case "registration-pending-confirmation":
      return (
        <RegistrationPendingConfirmationEmail
          tickerSymbol={input.tickerSymbol}
          name={input.name}
          confirmUrl={input.confirmUrl}
        />
      );
    case "invalid-ticker":
      return <InvalidTickerEmail tickerSymbol={input.tickerSymbol} />;
    default: {
      const _exhaustive: never = input;
      return _exhaustive;
    }
  }
}

/**
 * Renders the newsletter to HTML and plain text using the same props so content stays aligned.
 *
 * @param input - Template variant and its required props.
 * @returns HTML suitable for Resend `html` and plain text for `text`.
 */
export async function renderNewsletterEmail(
  input: RenderNewsletterEmailInput,
  dependencies: RenderNewsletterEmailDependencies = {},
): Promise<{ html: string; text: string }> {
  const element = newsletterElementForVariant(input);
  const renderHtml = dependencies.renderHtml ?? ((el) => render(el));
  const renderText =
    dependencies.renderText ?? ((el) => render(el, { plainText: true }));

  try {
    const [html, text] = await Promise.all([
      renderHtml(element),
      renderText(element),
    ]);
    return { html, text };
  } catch (error) {
    if (!shouldUseStaticFallbackRenderer(error)) {
      throw error;
    }

    const html = dependencies.fallbackRenderHtml
      ? dependencies.fallbackRenderHtml(element)
      : (await import("react-dom/server")).renderToStaticMarkup(element);
    const text = htmlToPlainText(html);
    return { html, text };
  }
}
