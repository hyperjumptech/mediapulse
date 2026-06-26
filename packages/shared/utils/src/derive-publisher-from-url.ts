const COMMON_SUBDOMAIN_PREFIXES = ["www", "amp", "m", "mobile"];

const MULTI_LEVEL_TLDS = new Set([
  "co.id",
  "com.my",
  "co.uk",
  "com.au",
  "co.jp",
  "com.sg",
  "co.th",
  "com.vn",
  "co.in",
  "com.br",
  "co.kr",
  "com.tr",
  "com.tw",
  "co.nz",
  "com.hk",
  "com.ph",
]);

export const derivePublisherFromUrl = (url: string): string => {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }

  const labels = hostname.split(".").filter((label) => label.length > 0);
  while (
    labels.length > 2 &&
    COMMON_SUBDOMAIN_PREFIXES.includes(labels[0] ?? "")
  ) {
    labels.shift();
  }

  if (labels.length === 0) {
    return "";
  }

  const lastTwo = labels.slice(-2).join(".");
  const brand =
    labels.length >= 3 && MULTI_LEVEL_TLDS.has(lastTwo)
      ? labels[labels.length - 3]
      : (labels[labels.length - 2] ?? labels[0]);

  if (brand === undefined || brand.length === 0) {
    return "";
  }

  return brand.charAt(0).toUpperCase() + brand.slice(1);
};
