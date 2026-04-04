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
 * @param variant - Template key; unknown values fall back to `default`.
 * @param props - Props passed to the template component.
 * @returns React element tree to render.
 */
function newsletterElementForVariant(
  variant: NewsletterTemplateVariant | undefined,
  props: any,
): ReactElement {
  const v = variant ?? "default";
  switch (v) {
    case "default":
      return (
        <DefaultNewsletterEmail
          title={props.title}
          bodyText={props.bodyText}
          footerNote={props.footerNote}
          preferencesUrl={props.preferencesUrl}
        />
      );
    case "registration-confirmation":
      return (
        <RegistrationConfirmationEmail tickerSymbol={props.tickerSymbol} />
      );
    case "invalid-ticker":
      return <InvalidTickerEmail tickerSymbol={props.tickerSymbol} />;
    default: {
      const _exhaustive: never = v;
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
  const element = newsletterElementForVariant(input.variant, input);

  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);

  return { html, text };
}
