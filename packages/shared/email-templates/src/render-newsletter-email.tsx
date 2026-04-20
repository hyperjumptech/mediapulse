import { render } from "@react-email/render";
import type { ReactElement } from "react";

import DefaultNewsletterEmail from "./newsletter/default-newsletter.js";
import type { DefaultNewsletterEmailProps } from "./newsletter/default-newsletter.js";
import RegistrationConfirmationEmail from "./registration/registration-confirmation.js";
import type { RegistrationConfirmationEmailProps } from "./registration/registration-confirmation.js";
import InvalidTickerEmail from "./registration/invalid-ticker.js";
import type { InvalidTickerEmailProps } from "./registration/invalid-ticker.js";

/** Supported newsletter template variants for rendering. */
export type NewsletterTemplateVariant =
  | "default"
  | "registration-confirmation"
  | "invalid-ticker";

export type RenderNewsletterEmailInput =
  | ({ variant?: "default" } & DefaultNewsletterEmailProps)
  | ({
      variant: "registration-confirmation";
    } & RegistrationConfirmationEmailProps)
  | ({ variant: "invalid-ticker" } & InvalidTickerEmailProps);

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
          preferencesUrl={input.preferencesUrl}
        />
      );
    case "registration-confirmation":
      return (
        <RegistrationConfirmationEmail tickerSymbol={input.tickerSymbol} />
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
): Promise<{ html: string; text: string }> {
  const element = newsletterElementForVariant(input);

  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);

  return { html, text };
}
