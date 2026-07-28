import {
  createSearchProvider,
  RoundRobinCursor,
  searchTopResults,
  type ProviderEntry,
  type SearchLocale,
  type SearchProvider,
  type SearchProviderLogger,
} from "@workspace/agent-search";

import type { Classification, ProfileParty } from "../pipeline/context";

export interface GatherReconSignalsInput {
  ticker: { symbol: string; name: string; aliases?: string[] };
  classification: Classification;
  homeMarket: string;
  competitors: ProfileParty[];
  providers: ProviderEntry[];
  locale: SearchLocale;
  maxQueries: number;
  maxCompetitors: number;
  maxSignals: number;
  resultsPerQuery: number;
  concurrency: number;
  timeoutMs: number;
  logger?: SearchProviderLogger;
  createProvider?: typeof createSearchProvider;
  search?: typeof searchTopResults;
}

const buildReconQueries = (input: GatherReconSignalsInput): string[] => {
  const sector = input.classification.industry ?? input.classification.sector;
  const queries: string[] = [];
  if (sector) {
    queries.push(`${sector} ${input.homeMarket} latest news`);
    queries.push(`${sector} ${input.homeMarket} trends`);
    queries.push(`${sector} ${input.homeMarket} consumer demand`);
  }
  for (const competitor of input.competitors.slice(0, input.maxCompetitors)) {
    queries.push(`${competitor.name} news`);
  }

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const query of queries) {
    const trimmed = query.trim();
    const key = trimmed.toLowerCase();
    if (key.length === 0 || seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(trimmed);
  }

  return deduped.slice(0, input.maxQueries);
};

const mapWithConcurrency = async <TItem, TResult>(
  items: TItem[],
  concurrency: number,
  worker: (item: TItem) => Promise<TResult>,
): Promise<TResult[]> => {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;
  const runners = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length)) },
    async () => {
      for (;;) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        if (currentIndex >= items.length) {
          return;
        }
        const item = items[currentIndex];
        if (item === undefined) {
          return;
        }
        results[currentIndex] = await worker(item);
      }
    },
  );
  await Promise.all(runners);

  return results;
};

export const gatherReconSignals = async (
  input: GatherReconSignalsInput,
): Promise<string[]> => {
  const createProvider = input.createProvider ?? createSearchProvider;
  const search = input.search ?? searchTopResults;

  try {
    const queries = buildReconQueries(input);
    const providers: SearchProvider[] = input.providers.map((entry) =>
      createProvider(entry),
    );
    if (queries.length === 0 || providers.length === 0) {
      return [];
    }

    const cursor = new RoundRobinCursor();
    const hitLists = await mapWithConcurrency(
      queries,
      input.concurrency,
      (query) =>
        search(query, {
          providers,
          locale: input.locale,
          cursor,
          timeoutMs: input.timeoutMs,
          limit: input.resultsPerQuery,
          ...(input.logger ? { logger: input.logger } : {}),
        }),
    );

    const seen = new Set<string>();
    const signals: string[] = [];
    for (const hits of hitLists) {
      for (const hit of hits) {
        const title = hit.title.trim();
        const key = title.toLowerCase();
        if (title.length === 0 || seen.has(key)) {
          continue;
        }
        seen.add(key);
        signals.push(title);
        if (signals.length >= input.maxSignals) {
          return signals;
        }
      }
    }

    return signals;
  } catch (error) {
    input.logger?.warn(
      {
        tickerSymbol: input.ticker.symbol,
        errName: (error as { name?: string })?.name,
      },
      "query-analysis recon failed; generating without recent signals",
    );

    return [];
  }
};
