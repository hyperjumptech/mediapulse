const COMMON_SUBDOMAIN_PREFIXES = ["www", "amp", "m", "mobile"];

const MULTI_LEVEL_TLDS = new Set([
  "co.id",
  "or.id",
  "go.id",
  "ac.id",
  "sch.id",
  "net.id",
  "web.id",
  "my.id",
  "biz.id",
  "desa.id",
  "mil.id",
  "com.my",
  "org.my",
  "gov.my",
  "edu.my",
  "co.uk",
  "org.uk",
  "gov.uk",
  "ac.uk",
  "com.au",
  "org.au",
  "gov.au",
  "edu.au",
  "co.jp",
  "or.jp",
  "go.jp",
  "ac.jp",
  "com.sg",
  "org.sg",
  "gov.sg",
  "edu.sg",
  "co.th",
  "go.th",
  "ac.th",
  "com.vn",
  "gov.vn",
  "edu.vn",
  "co.in",
  "gov.in",
  "ac.in",
  "com.br",
  "gov.br",
  "co.kr",
  "go.kr",
  "ac.kr",
  "com.tr",
  "gov.tr",
  "com.tw",
  "gov.tw",
  "co.nz",
  "govt.nz",
  "ac.nz",
  "com.hk",
  "gov.hk",
  "com.ph",
  "gov.ph",
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
