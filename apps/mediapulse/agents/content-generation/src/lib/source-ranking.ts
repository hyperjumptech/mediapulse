import type { SourceForGeneration } from "../types.js";

/** Publisher tier used for host-class scoring. */
export type HostTier = "tier1" | "tier2" | "tier3" | "unknown";

/** Per-signal breakdown attached to each ranked source for observability. */
export type RankedSourceComponents = {
  relevanceRank: number;
  recencyHours: number | null;
  hostTier: HostTier;
  bodyLengthChars: number;
};

/** Source with composite ranking score and component breakdown. */
export type RankedSource = SourceForGeneration & {
  score: number;
  components: RankedSourceComponents;
};

/** Weight knobs for the composite ranking formula. */
export type SourceRankingWeights = {
  relevance: number;
  recency: number;
  tier: number;
  length: number;
};

/** Default composite-score weights for source ranking. */
export const DEFAULT_SOURCE_RANKING_WEIGHTS: SourceRankingWeights = {
  relevance: 0.45,
  recency: 0.25,
  tier: 0.2,
  length: 0.1,
};

/** Default recency half-life in hours for newsletter source ranking. */
export const DEFAULT_SOURCE_RANKING_RECENCY_HALF_LIFE_HOURS = 36;

/** Options for {@link rankSourcesForNewsletter}. */
export type RankSourcesForNewsletterOptions = {
  recencyHalfLifeHours?: number;
  weights?: Partial<SourceRankingWeights>;
  /** Reference time for recency; defaults to `Date.now()`. */
  now?: Date;
};

/** Options for {@link diversifyByHost}. */
export type DiversifyByHostOptions = {
  maxPerHost: number;
  /** When set, stop after this many picks (defaults to all ranked sources). */
  limit?: number;
};

/** One-line observability payload logged before the LLM call. */
export type SourceMixObservability = {
  tickerId: string;
  selectedHosts: string[];
  hostTierDistribution: Record<HostTier, number>;
  recencyP50Hours: number | null;
};

/**
 * Hand-maintained hostname suffix lists per publisher tier (suffix match on URL host).
 * Keep tier semantics aligned with article-analysis `HOST_TIERS` where domains overlap.
 */
export const HOST_TIERS: Record<
  Exclude<HostTier, "unknown">,
  readonly string[]
> = {
  tier1: [
    "reuters.com",
    "bloomberg.com",
    "ft.com",
    "wsj.com",
    "kontan.co.id",
    "bisnis.com",
  ],
  tier2: [
    "cnbcindonesia.com",
    "detik.com",
    "tempo.co",
    "kompas.com",
    "idnfinancials.com",
  ],
  tier3: [],
};

const TIER_FACTORS: Record<HostTier, number> = {
  tier1: 1.0,
  tier2: 0.7,
  tier3: 0.4,
  unknown: 0.2,
};

const NEUTRAL_RECENCY_FACTOR = 0.5;
const LENGTH_NORMALIZER_CHARS = 1200;

/**
 * Parses a URL hostname in lowercase without a leading `www.` segment.
 *
 * @param url - Article URL.
 * @returns Hostname or null when parsing fails.
 */
export const parseSourceHostname = (url: string): string | null => {
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
const hostnameMatchesTierDomain = (hostname: string, domain: string): boolean =>
  hostname === domain || hostname.endsWith(`.${domain}`);

/**
 * Returns true when the hostname looks like a bare IPv4 address.
 *
 * @param hostname - Normalized hostname.
 */
const isBareIpHostname = (hostname: string): boolean =>
  /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(hostname);

/**
 * Returns true when the hostname has a conventional public suffix (e.g. `.com`).
 *
 * @param hostname - Normalized hostname.
 */
const hasRecognizableTld = (hostname: string): boolean => {
  const parts = hostname.split(".");
  const tld = parts[parts.length - 1];
  return parts.length >= 2 && tld !== undefined && tld.length >= 2;
};

/**
 * Resolves the publisher tier for a source URL.
 *
 * @param url - Article URL.
 */
export const classifyHostTier = (url: string): HostTier => {
  const hostname = parseSourceHostname(url);
  if (hostname === null) {
    return "unknown";
  }
  if (isBareIpHostname(hostname) || hostname.endsWith(".xyz")) {
    return "unknown";
  }

  for (const tier of ["tier1", "tier2"] as const) {
    for (const domain of HOST_TIERS[tier]) {
      if (hostnameMatchesTierDomain(hostname, domain)) {
        return tier;
      }
    }
  }

  return hasRecognizableTld(hostname) ? "tier3" : "unknown";
};

/**
 * Extracts the canonical host bucket suffix used for diversification caps.
 *
 * @param url - Article URL.
 */
export const extractHostBucket = (url: string): string => {
  const hostname = parseSourceHostname(url);
  if (hostname === null) {
    return "unknown-host";
  }

  for (const tier of ["tier1", "tier2"] as const) {
    for (const domain of HOST_TIERS[tier]) {
      if (hostnameMatchesTierDomain(hostname, domain)) {
        return domain;
      }
    }
  }

  return hostname;
};

/**
 * Extracts the hostname used for diversification caps.
 *
 * @param source - Ranked or raw source row.
 */
export const extractSourceHost = (
  source: Pick<SourceForGeneration, "url">,
): string => extractHostBucket(source.url);

/**
 * Reads `publishedAt` when the data-api returns it (ISO 8601 string).
 *
 * @param source - Source row from content-generation fetch.
 * @returns Epoch milliseconds or null when absent/invalid.
 */
export const extractPublishedAtMs = (
  source: SourceForGeneration,
): number | null => {
  const raw = source.publishedAt;
  if (
    raw == null ||
    raw === "" ||
    (typeof raw === "string" && raw.trim() === "")
  ) {
    return null;
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Clamps a number into `[0, 1]`.
 *
 * @param value - Raw value.
 */
const clampUnit = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Computes the recency factor for a source; null dates receive a neutral score.
 *
 * @param publishedAtMs - Parsed publish time or null.
 * @param nowMs - Reference time in epoch ms.
 * @param recencyHalfLifeHours - Half-life for exponential decay.
 */
const computeRecencyFactor = (
  publishedAtMs: number | null,
  nowMs: number,
  recencyHalfLifeHours: number,
): number => {
  if (publishedAtMs === null) {
    return NEUTRAL_RECENCY_FACTOR;
  }
  const hours = Math.max(0, (nowMs - publishedAtMs) / (1000 * 60 * 60));
  return clampUnit(Math.exp(-hours / recencyHalfLifeHours));
};

/**
 * Computes age in hours when `publishedAt` is known.
 *
 * @param publishedAtMs - Parsed publish time or null.
 * @param nowMs - Reference time in epoch ms.
 */
const computeRecencyHours = (
  publishedAtMs: number | null,
  nowMs: number,
): number | null => {
  if (publishedAtMs === null) {
    return null;
  }
  return Math.max(0, (nowMs - publishedAtMs) / (1000 * 60 * 60));
};

/**
 * Builds the composite ranking score for one source at a fixed relevance rank.
 *
 * @param source - Candidate source (post-truncation content length).
 * @param relevanceRank - Zero-based index in the incoming relevance order.
 * @param opts - Weight and recency configuration.
 */
export const scoreSourceForNewsletter = (
  source: SourceForGeneration,
  relevanceRank: number,
  opts: Required<
    Pick<RankSourcesForNewsletterOptions, "recencyHalfLifeHours">
  > & {
    weights: SourceRankingWeights;
    now?: Date;
  },
): RankedSource => {
  const nowMs = (opts.now ?? new Date()).getTime();
  const publishedAtMs = extractPublishedAtMs(source);
  const hostTier = classifyHostTier(source.url);
  const bodyLengthChars = source.content.length;
  const recencyHours = computeRecencyHours(publishedAtMs, nowMs);
  const recencyFactor = computeRecencyFactor(
    publishedAtMs,
    nowMs,
    opts.recencyHalfLifeHours,
  );
  const lengthFactor = clampUnit(bodyLengthChars / LENGTH_NORMALIZER_CHARS);
  const relevanceFactor = 1 / (relevanceRank + 1);

  const score =
    opts.weights.relevance * relevanceFactor +
    opts.weights.recency * recencyFactor +
    opts.weights.tier * TIER_FACTORS[hostTier] +
    opts.weights.length * lengthFactor;

  return {
    ...source,
    score,
    components: {
      relevanceRank,
      recencyHours,
      hostTier,
      bodyLengthChars,
    },
  };
};

/**
 * Scores each source and returns a list sorted by composite score (descending).
 *
 * @param sources - Sources in relevance order from `getDataSourcesForTicker`.
 * @param opts - Ranking weights and recency half-life.
 */
export const rankSourcesForNewsletter = (
  sources: SourceForGeneration[],
  opts: RankSourcesForNewsletterOptions = {},
): RankedSource[] => {
  const resolvedOpts = {
    recencyHalfLifeHours:
      opts.recencyHalfLifeHours ??
      DEFAULT_SOURCE_RANKING_RECENCY_HALF_LIFE_HOURS,
    weights: {
      ...DEFAULT_SOURCE_RANKING_WEIGHTS,
      ...opts.weights,
    },
    now: opts.now,
  };

  const ranked = sources.map((source, index) =>
    scoreSourceForNewsletter(source, index, resolvedOpts),
  );
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
};

/**
 * Greedy host-cap pass: prefer high scores while limiting picks per hostname.
 * When every remaining host is at cap, falls back to pure score order (spillover).
 *
 * @param ranked - Score-sorted sources from {@link rankSourcesForNewsletter}.
 * @param opts - Host cap and optional pick limit.
 */
export const diversifyByHost = (
  ranked: RankedSource[],
  opts: DiversifyByHostOptions,
): RankedSource[] => {
  const limit = opts.limit ?? ranked.length;
  if (limit <= 0 || ranked.length === 0) {
    return [];
  }

  const hostCounts = new Map<string, number>();
  const picked: RankedSource[] = [];
  const usedIndices = new Set<number>();

  while (picked.length < limit && usedIndices.size < ranked.length) {
    let pickIndex = -1;

    for (let i = 0; i < ranked.length; i += 1) {
      if (usedIndices.has(i)) {
        continue;
      }
      const host = extractSourceHost(ranked[i]!);
      if ((hostCounts.get(host) ?? 0) < opts.maxPerHost) {
        pickIndex = i;
        break;
      }
    }

    if (pickIndex === -1) {
      for (let i = 0; i < ranked.length; i += 1) {
        if (!usedIndices.has(i)) {
          pickIndex = i;
          break;
        }
      }
    }

    if (pickIndex === -1) {
      break;
    }

    usedIndices.add(pickIndex);
    const source = ranked[pickIndex]!;
    picked.push(source);
    const host = extractSourceHost(source);
    hostCounts.set(host, (hostCounts.get(host) ?? 0) + 1);
  }

  return picked;
};

/**
 * Computes median recency hours for sources with a known publish date.
 *
 * @param sources - Selected ranked sources.
 */
export const computeRecencyP50Hours = (
  sources: RankedSource[],
): number | null => {
  const hours = sources
    .map((source) => source.components.recencyHours)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  if (hours.length === 0) {
    return null;
  }

  const mid = Math.floor(hours.length / 2);
  if (hours.length % 2 === 1) {
    return hours[mid]!;
  }
  return (hours[mid - 1]! + hours[mid]!) / 2;
};

/**
 * Builds the one-line source-mix log payload for ops dashboards.
 *
 * @param tickerId - Ticker being processed.
 * @param selected - Final prompt sources (post-rank, post-diversify, post-slice).
 */
export const buildSourceMixObservability = (
  tickerId: string,
  selected: RankedSource[],
): SourceMixObservability => {
  const hostTierDistribution: Record<HostTier, number> = {
    tier1: 0,
    tier2: 0,
    tier3: 0,
    unknown: 0,
  };

  for (const source of selected) {
    hostTierDistribution[source.components.hostTier] += 1;
  }

  return {
    tickerId,
    selectedHosts: selected.map((source) => extractSourceHost(source)),
    hostTierDistribution,
    recencyP50Hours: computeRecencyP50Hours(selected),
  };
};
