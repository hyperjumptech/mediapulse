import type { RenderNewsletterEmailInput } from "@workspace/email-templates";

import type { DeliveryConfig } from "./config-schema.js";

export type NewsletterRenderInputOptions = {
  userTickerId: string;
  language: "en" | "id";
  title: string;
  bodyText: string;
  unsubscribeUrl: string;
  tickerSymbol: string;
  template: DeliveryConfig["template"];
  day1FirstIssueUserTickerIds: string[];
};

export const buildNewsletterRenderInput = ({
  userTickerId,
  language,
  title,
  bodyText,
  unsubscribeUrl,
  tickerSymbol,
  template,
  day1FirstIssueUserTickerIds,
}: NewsletterRenderInputOptions): RenderNewsletterEmailInput => {
  if (!day1FirstIssueUserTickerIds.includes(userTickerId)) {
    return {
      title,
      bodyText,
      variant: template.newsletterVariant,
      unsubscribeUrl,
      tickerSymbol,
      language,
    };
  }
  const reviewTimeLabel = template.reviewTimeLabels?.[language];

  return {
    variant: "day1-first-issue",
    title,
    bodyText,
    unsubscribeUrl,
    tickerSymbol,
    language,
    ...(reviewTimeLabel !== undefined ? { reviewTimeLabel } : {}),
  };
};
