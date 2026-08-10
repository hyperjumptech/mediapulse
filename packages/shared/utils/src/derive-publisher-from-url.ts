import { getDomainWithoutSuffix } from "tldts";

export const derivePublisherFromUrl = (url: string): string => {
  const brand = getDomainWithoutSuffix(url);
  if (brand === null || brand.length === 0) {
    return "";
  }

  return brand.charAt(0).toUpperCase() + brand.slice(1);
};
