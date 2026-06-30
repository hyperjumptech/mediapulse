import type { ReactElement } from "react";

import {
  DefaultNewsletterEmail,
  NEWSLETTER_PREVIEW_PROPS,
} from "./default-newsletter.js";
import type { DefaultNewsletterEmailProps } from "./default-newsletter.js";

/**
 * Preview-only English newsletter. Gives the React Email dev server a clean
 * "newsletter-en" entry. Not exported from the package barrel; delivery renders
 * {@link DefaultNewsletterEmail} directly with the subscriber's language.
 *
 * @param props - Same props as {@link DefaultNewsletterEmail}.
 * @returns The newsletter email with the English footer.
 */
const NewsletterEnglishPreview = (
  props: DefaultNewsletterEmailProps,
): ReactElement => <DefaultNewsletterEmail {...props} />;

NewsletterEnglishPreview.PreviewProps = {
  ...NEWSLETTER_PREVIEW_PROPS,
  language: "en",
} satisfies DefaultNewsletterEmailProps;

export default NewsletterEnglishPreview;
