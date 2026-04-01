import { render } from "@react-email/render";
import type { ReactElement } from "react";

import DefaultNewsletterEmail from "./newsletter/default-newsletter.js";
import type { DefaultNewsletterEmailProps } from "./newsletter/default-newsletter.js";

/** Supported newsletter template variants for rendering. */
export type NewsletterTemplateVariant = "default";

export type RenderNewsletterEmailInput = DefaultNewsletterEmailProps & {
  /** Which React Email template to render; v1 ships `default` only. */
  variant?: NewsletterTemplateVariant;
};

/**
 * Selects the React Email root element for the given variant.
 *
 * @param variant - Template key; unknown values fall back to `default`.
 * @param props - Props passed to the template component.
 * @returns React element tree to render.
 */
function newsletterElementForVariant(
  variant: NewsletterTemplateVariant | undefined,
  props: DefaultNewsletterEmailProps,
): ReactElement {
  const v = variant ?? "default";
  switch (v) {
    case "default":
      return (
        <DefaultNewsletterEmail
          title={props.title}
          bodyText={props.bodyText}
          footerNote={props.footerNote}
        />
      );
    default: {
      const _exhaustive: never = v;
      return _exhaustive;
    }
  }
}

/**
 * Renders the newsletter to HTML and plain text using the same props so content stays aligned.
 *
 * @param input - Title, body text, optional footer, and template variant.
 * @returns HTML suitable for Resend `html` and plain text for `text`.
 */
export async function renderNewsletterEmail(
  input: RenderNewsletterEmailInput,
): Promise<{ html: string; text: string }> {
  const element = newsletterElementForVariant(input.variant, {
    title: input.title,
    bodyText: input.bodyText,
    footerNote: input.footerNote,
  });

  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);

  return { html, text };
}
