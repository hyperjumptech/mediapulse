import { z } from "zod";

export const OPEN_PAGE_RANK_BASE_URL =
  "https://openpagerank.keywordseverywhere.com/v1/domains/bulk";

export const OPEN_PAGE_RANK_MAX_DOMAINS_PER_REQUEST = 100;

const openPageRankResultSchema = z.object({
  domain: z.string(),
  found: z.boolean(),
  open_page_rank: z.number().nullable(),
  rank: z.number().nullable(),
  referring_domains: z.number().nullable(),
});

const openPageRankResponseSchema = z.object({
  as_of: z.string().nullable().optional(),
  results: z.array(openPageRankResultSchema),
});

export type OpenPageRankScore = {
  domain: string;
  openPageRank: number | null;
  globalRank: number | null;
  referringDomains: number | null;
  asOf: string | null;
};

export type OpenPageRankBatch = {
  scores: OpenPageRankScore[];
  domainsRemaining: number | null;
};

export type FetchOpenPageRankOptions = {
  apiKey: string;
  domains: readonly string[];
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

export async function fetchOpenPageRank({
  apiKey,
  domains,
  baseUrl = OPEN_PAGE_RANK_BASE_URL,
  fetchImpl = fetch,
}: FetchOpenPageRankOptions): Promise<OpenPageRankBatch> {
  if (domains.length === 0) {
    return { scores: [], domainsRemaining: null };
  }

  if (domains.length > OPEN_PAGE_RANK_MAX_DOMAINS_PER_REQUEST) {
    throw new Error(
      `OpenPageRank accepts at most ${OPEN_PAGE_RANK_MAX_DOMAINS_PER_REQUEST} domains per request, got ${domains.length}.`,
    );
  }

  const response = await fetchImpl(baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ domains: [...domains], include_history: false }),
  });

  if (!response.ok) {
    throw new Error(
      `OpenPageRank request failed with status ${response.status}`,
    );
  }

  const parsed = openPageRankResponseSchema.parse(await response.json());
  const asOf = parsed.as_of ?? null;
  const remainingHeader = response.headers.get("X-Domains-Remaining");
  const domainsRemaining =
    remainingHeader !== null && /^\d+$/.test(remainingHeader.trim())
      ? Number.parseInt(remainingHeader.trim(), 10)
      : null;

  const scores = parsed.results.map((result) => ({
    domain: result.domain,
    openPageRank: result.found ? result.open_page_rank : null,
    globalRank: result.found ? result.rank : null,
    referringDomains: result.found ? result.referring_domains : null,
    asOf,
  }));

  return { scores, domainsRemaining };
}
