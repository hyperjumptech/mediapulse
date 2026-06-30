import type { ReactElement } from "react";

import {
  DefaultNewsletterEmail,
  NEWSLETTER_PREVIEW_PROPS,
} from "./default-newsletter.js";
import type { DefaultNewsletterEmailProps } from "./default-newsletter.js";

/**
 * Preview-only Indonesian newsletter. Gives the React Email dev server a clean
 * "newsletter-id" entry so the localized footer can be eyeballed next to the
 * English one. Not exported from the package barrel.
 *
 * @param props - Same props as {@link DefaultNewsletterEmail}.
 * @returns The newsletter email with the Indonesian footer.
 */
const NewsletterIndonesianPreview = (
  props: DefaultNewsletterEmailProps,
): ReactElement => <DefaultNewsletterEmail {...props} />;

NewsletterIndonesianPreview.PreviewProps = {
  ...NEWSLETTER_PREVIEW_PROPS,
  language: "id",
} satisfies DefaultNewsletterEmailProps;

export default NewsletterIndonesianPreview;
