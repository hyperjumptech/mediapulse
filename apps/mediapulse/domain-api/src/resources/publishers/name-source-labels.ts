import type { PublisherNameSource } from "@mediapulse/database";

export const publisherNameSourceLabels = {
  manual: "Manual",
  site_metadata: "Site metadata",
  llm: "Model",
  derived: "From URL",
} as const satisfies Record<PublisherNameSource, string>;

const publisherNameSources = Object.keys(
  publisherNameSourceLabels,
) as PublisherNameSource[];

export const parsePublisherNameSource = (
  raw: string | undefined,
): PublisherNameSource | undefined => {
  const trimmed = raw?.trim();

  return publisherNameSources.find((nameSource) => nameSource === trimmed);
};
