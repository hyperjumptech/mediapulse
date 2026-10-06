import {
  publisherNameMayReplace,
  type PublisherNameSourceValue,
} from "@workspace/agent-data-api-contract";

export type PublisherNameCandidates = {
  storedName: string | undefined;
  storedNameSource: PublisherNameSourceValue | null | undefined;
  fetchedSiteName: string | undefined;
};

export const pickPublisherName = ({
  storedName,
  storedNameSource,
  fetchedSiteName,
}: PublisherNameCandidates): string | undefined => {
  if (fetchedSiteName === undefined || storedName === undefined) {
    return fetchedSiteName ?? storedName;
  }

  return publisherNameMayReplace("site_metadata", storedNameSource)
    ? fetchedSiteName
    : storedName;
};
