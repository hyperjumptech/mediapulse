const AMP_SUFFIX_HOSTS = ["timesindonesia.co.id"];

const matchesHost = (hostname: string, host: string): boolean => {
  const bare = hostname.replace(/^www\./, "");

  return bare === host || bare.endsWith(`.${host}`);
};

export const fetchUrlFor = (url: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const usesAmpSuffix = AMP_SUFFIX_HOSTS.some((host) =>
    matchesHost(parsed.hostname, host),
  );
  if (!usesAmpSuffix || /\/amp\/?$/.test(parsed.pathname)) {
    return url;
  }
  parsed.search = "";
  parsed.hash = "";
  parsed.pathname = `${parsed.pathname.replace(/\/+$/, "")}/amp`;

  return parsed.toString();
};
