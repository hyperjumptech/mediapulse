/**
 * Scores source quality from trusted domains with fallback score.
 *
 * @param articleUrl - Article URL.
 * @param trustedDomains - Domain score mapping.
 * @returns Trusted-domain score or 0.5 fallback.
 */
export const scoreSourceQuality = ({
  articleUrl,
  trustedDomains,
}: {
  articleUrl: string;
  trustedDomains: Record<string, number>;
}): number => {
  const host = extractHost(articleUrl);
  if (!host) {
    return 0.5;
  }

  const normalizedHost = host.replace(/^www\./, "");
  return trustedDomains[normalizedHost] ?? trustedDomains[host] ?? 0.5;
};

/**
 * Safely extracts URL host from a URL string.
 *
 * @param articleUrl - Raw URL.
 * @returns Hostname or null when parsing fails.
 */
const extractHost = (articleUrl: string): string | null => {
  try {
    return new URL(articleUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
};
