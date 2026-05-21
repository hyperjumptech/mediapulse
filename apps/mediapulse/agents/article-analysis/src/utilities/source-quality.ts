/** Default hostname suffix lists per publisher tier (suffix-matched on URL host). */
export const HOST_TIERS = {
  tier1: [
    "reuters.com",
    "bloomberg.com",
    "apnews.com",
    "wsj.com",
    "ft.com",
    "nytimes.com",
  ],
  tier2: [
    "cnbc.com",
    "marketwatch.com",
    "barrons.com",
    "forbes.com",
    "businessinsider.com",
    "seekingalpha.com",
    "reuters.co.uk",
  ],
  tier3: ["medium.com", "substack.com", "benzinga.com"],
} as const;

export type HostTier = keyof typeof HOST_TIERS | "unknown";

const HOST_TIER_SCORES: Record<HostTier, number> = {
  tier1: 0.9,
  tier2: 0.7,
  tier3: 0.4,
  unknown: 0.5,
};

const DEFAULT_INTERNAL_WEIGHTS = {
  host: 0.5,
  recency: 0.3,
  structural: 0.2,
} as const;

/** Article row fields used for deterministic source-quality scoring. */
export type SourceQualityInput = {
  url: string;
  title: string;
  content: string;
  createdAt: Date;
  publishedAt?: Date | null;
};

/** Injectable context for {@link computeSourceQuality}. */
export type SourceQualityComputeCtx = {
  now: Date;
  recencyHalfLifeHours?: number;
  hostTiers?: Partial<Record<keyof typeof HOST_TIERS, readonly string[]>>;
};

/** Per-signal breakdown returned alongside the aggregate score. */
export type SourceQualityMeta = {
  qualityScore: number;
  hostClassScore: number;
  hostTier: HostTier;
  recencyScore: number;
  ageHours: number | null;
  structuralScore: number;
};

/**
 * Clamps a number into `[0, 1]`.
 *
 * @param value - Raw value.
 */
const clampUnit = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Parses a URL hostname in lowercase without a leading `www.` segment.
 *
 * @param url - Article URL.
 * @returns Hostname or null when parsing fails.
 */
export const parseArticleHostname = (url: string): string | null => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  } catch {
    return null;
  }
};

/**
 * Returns true when `hostname` suffix-matches a configured tier domain.
 *
 * @param hostname - Normalized hostname.
 * @param domain - Tier domain suffix (e.g. `reuters.com`).
 */
export const hostnameMatchesTierDomain = (
  hostname: string,
  domain: string,
): boolean => hostname === domain || hostname.endsWith(`.${domain}`);

/**
 * Resolves the publisher tier for a URL hostname.
 *
 * @param url - Article URL.
 * @param hostTiers - Optional operator overrides (replaces defaults per tier).
 */
export const classifyHostTier = (
  url: string,
  hostTiers: SourceQualityComputeCtx["hostTiers"] = {},
): HostTier => {
  const hostname = parseArticleHostname(url);
  if (hostname === null) {
    return "unknown";
  }

  const tiers: Array<keyof typeof HOST_TIERS> = ["tier1", "tier2", "tier3"];
  for (const tier of tiers) {
    const domains = hostTiers[tier] ?? HOST_TIERS[tier];
    if (domains.some((domain) => hostnameMatchesTierDomain(hostname, domain))) {
      return tier;
    }
  }

  return "unknown";
};

/**
 * Maps a URL to a host-class subscore using tier lists (suffix match on hostname).
 *
 * @param url - Article URL.
 * @param hostTiers - Optional operator overrides (replaces defaults per tier).
 */
export const hostClassScore = (
  url: string,
  hostTiers: SourceQualityComputeCtx["hostTiers"] = {},
): number => HOST_TIER_SCORES[classifyHostTier(url, hostTiers)];

/**
 * Exponential recency subscore from `publishedAt` or `createdAt`.
 *
 * @param source - Article row with optional `publishedAt`.
 * @param now - Reference instant (injected for tests).
 * @param halfLifeHours - Decay half-life in hours (default 72).
 */
export const recencyScore = (
  source: {
    createdAt?: Date | null;
    publishedAt?: Date | null;
  },
  now: Date,
  halfLifeHours = 72,
): { score: number; ageHours: number | null } => {
  const reference = source.publishedAt ?? source.createdAt;
  if (reference == null || reference === undefined) {
    return { score: 0.5, ageHours: null };
  }

  const referenceMs =
    reference instanceof Date
      ? reference.getTime()
      : new Date(reference).getTime();
  if (!Number.isFinite(referenceMs)) {
    return { score: 0.5, ageHours: null };
  }

  const ageHours = Math.max(0, (now.getTime() - referenceMs) / 3_600_000);
  const score = clampUnit(Math.exp(-ageHours / halfLifeHours));
  return { score, ageHours };
};

/**
 * Uppercase-letter ratio for Latin letters in a string.
 *
 * @param text - Body text (title excluded for shouting check).
 */
export const uppercaseLetterRatio = (text: string): number => {
  let upper = 0;
  let letters = 0;
  for (const char of text) {
    if (/[A-Z]/.test(char)) {
      upper += 1;
      letters += 1;
    } else if (/[a-z]/.test(char)) {
      letters += 1;
    }
  }
  return letters === 0 ? 0 : upper / letters;
};

/**
 * Length subscore for article body character count.
 *
 * @param length - `content.length`.
 */
export const contentLengthScore = (length: number): number => {
  if (length < 500) {
    return 0.2;
  }
  if (length < 1500) {
    return 0.2 + ((length - 500) / 1000) * 0.8;
  }
  if (length <= 8000) {
    return 1;
  }
  if (length < 15000) {
    return 1 - ((length - 8000) / 7000) * 0.4;
  }
  return 0.6;
};

/**
 * Structural subscore from length, paragraph breaks, and shouting in the body.
 *
 * @param source - Article title and body.
 */
export const structuralScore = (
  source: Pick<SourceQualityInput, "title" | "content">,
): number => {
  const lengthScore = contentLengthScore(source.content.length);
  const paragraphBreaks = source.content.split("\n\n").length - 1;
  const paragraphScore = clampUnit(paragraphBreaks / 3);
  const shoutingRatio = uppercaseLetterRatio(source.content);
  const shoutingScore =
    shoutingRatio <= 0.15 ? 1 : clampUnit(1 - (shoutingRatio - 0.15) / 0.35);

  return clampUnit(
    0.5 * lengthScore + 0.3 * paragraphScore + 0.2 * shoutingScore,
  );
};

/**
 * Computes the three sub-signals and combined source-quality score in `[0, 1]`.
 *
 * @param source - Article row from analysis GET.
 * @param ctx - Clock and optional tier / recency overrides.
 */
export const computeSourceQualityWithMeta = (
  source: SourceQualityInput,
  ctx: SourceQualityComputeCtx,
): SourceQualityMeta => {
  const hostTier = classifyHostTier(source.url, ctx.hostTiers);
  const hostScore = HOST_TIER_SCORES[hostTier];
  const recency = recencyScore(source, ctx.now, ctx.recencyHalfLifeHours ?? 72);
  const structural = structuralScore(source);
  const qualityScore = clampUnit(
    DEFAULT_INTERNAL_WEIGHTS.host * hostScore +
      DEFAULT_INTERNAL_WEIGHTS.recency * recency.score +
      DEFAULT_INTERNAL_WEIGHTS.structural * structural,
  );

  return {
    qualityScore,
    hostClassScore: hostScore,
    hostTier,
    recencyScore: recency.score,
    ageHours: recency.ageHours,
    structuralScore: structural,
  };
};

/**
 * Returns a single source-quality score in `[0, 1]` for relevance breakdown.
 *
 * @param source - Article row from analysis GET.
 * @param ctx - Clock and optional tier / recency overrides.
 */
export const computeSourceQuality = (
  source: SourceQualityInput,
  ctx: SourceQualityComputeCtx,
): number => computeSourceQualityWithMeta(source, ctx).qualityScore;
