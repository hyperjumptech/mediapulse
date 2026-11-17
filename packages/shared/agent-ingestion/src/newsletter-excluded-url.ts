import {
  classifyNoisyUrl,
  isUnresolvableAggregatorUrl,
  isUserGeneratedHost,
} from "@workspace/utils";

export type NewsletterExclusion = "blocked_host" | "user_generated";

export const newsletterExclusionOf = (
  url: string,
): NewsletterExclusion | undefined => {
  if (classifyNoisyUrl(url).blocked || isUnresolvableAggregatorUrl(url)) {
    return "blocked_host";
  }
  if (isUserGeneratedHost(url)) {
    return "user_generated";
  }

  return undefined;
};

export const withoutNewsletterExclusions = <Source extends { url: string }>(
  sources: readonly Source[],
): Source[] =>
  sources.filter((source) => newsletterExclusionOf(source.url) === undefined);
