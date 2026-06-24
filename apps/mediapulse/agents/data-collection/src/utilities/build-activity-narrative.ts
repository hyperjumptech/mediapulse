export type TickerSubject = { symbol: string; name: string };

function n(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

export function narrativeRunStart(subject: TickerSubject): [string, string] {
  return [
    `Collecting news for ${subject.symbol}`,
    `Loading search queries and context for ${subject.symbol} (${subject.name}).`,
  ];
}

export function narrativeQueriesLoaded(
  subject: TickerSubject,
  queryCount: number,
): [string, string] {
  if (queryCount === 0) {
    return [
      "No search queries configured",
      `${subject.symbol} (${subject.name}) has no active search queries. Skipping collection.`,
    ];
  }
  return [
    "Search queries loaded",
    `${n(queryCount, "search query", "search queries")} ready for ${subject.symbol}.`,
  ];
}

export function narrativeDailyQuota(
  subject: TickerSubject,
  existingCount: number,
  target: number,
): [string, string] {
  return [
    "Checking daily quota",
    `${subject.symbol} has ${n(existingCount, "saved source")} today against a target of ${target}.`,
  ];
}

export function narrativeSearchRound(
  subject: TickerSubject,
  queryCount: number,
  round: number,
  maxRounds: number,
): [string, string] {
  if (round === 1) {
    return [
      "Searching the web",
      `Running ${n(queryCount, "search query", "search queries")} for ${subject.symbol}.`,
    ];
  }
  return [
    "Search refill round",
    `Refill round ${round} of ${maxRounds}: running ${n(queryCount, "search query", "search queries")} for ${subject.symbol} to reach the daily target.`,
  ];
}

export function narrativeFilteredResults(
  readyCount: number,
  droppedCount: number,
): [string, string] {
  if (droppedCount === 0) {
    return ["Filtering results", `${n(readyCount, "URL")} ready to fetch.`];
  }
  return [
    "Filtering results",
    `${n(readyCount, "URL")} ready to fetch, after removing ${n(droppedCount, "result")} that were already saved, noisy, or known to be dead.`,
  ];
}

export function narrativeFetchStart(
  subject: TickerSubject,
  urlCount: number,
): [string, string] {
  return [
    "Fetching articles",
    `Downloading ${n(urlCount, "candidate URL")} for ${subject.symbol}.`,
  ];
}

export function narrativeSavingSources(
  subject: TickerSubject,
  fetchedCount: number,
): [string, string] {
  return [
    "Saving sources",
    `Applying relevance, freshness, and quality checks to ${n(fetchedCount, "fetched page")} for ${subject.symbol}.`,
  ];
}

export function narrativeRunComplete(
  subject: TickerSubject,
  opts: {
    status: "success" | "partial_success" | "failed";
    persisted: number;
    droppedByRelevance: number;
    droppedByFreshness: number;
    contentQualityDropped: number;
    failureCount: number;
    stopReason: string | null;
    roundsExecuted: number;
    targetSavedSources: number;
  },
): [string, string] {
  const title =
    opts.status === "failed" ? "Collection failed" : "Collection complete";

  const savedClause =
    opts.persisted > 0
      ? `Saved ${n(opts.persisted, "new source")} for ${subject.symbol}`
      : `No new sources were saved for ${subject.symbol}`;

  const dropParts: string[] = [];
  if (opts.droppedByRelevance > 0) {
    dropParts.push(
      `${opts.droppedByRelevance} did not mention ${subject.symbol}`,
    );
  }
  if (opts.droppedByFreshness > 0) {
    dropParts.push(`${opts.droppedByFreshness} were stale`);
  }
  if (opts.contentQualityDropped > 0) {
    dropParts.push(`${opts.contentQualityDropped} failed quality checks`);
  }

  const dropClause =
    dropParts.length > 0 ? `; ${dropParts.join(", ")} and were dropped` : "";

  let stopClause = "";
  if (
    opts.stopReason === "daily_target_met" ||
    opts.stopReason === "daily_target_met_before_start"
  ) {
    stopClause = ` The daily target of ${opts.targetSavedSources} was reached.`;
  } else if (opts.stopReason === "max_rounds_reached") {
    stopClause = ` The maximum number of search rounds was reached.`;
  } else if (opts.stopReason === "no_progress") {
    stopClause = ` No new articles were found in the last round.`;
  }

  const failureClause =
    opts.failureCount > 0
      ? ` ${opts.failureCount} fetch error${opts.failureCount === 1 ? "" : "s"} recorded.`
      : "";

  const description = `${savedClause}${dropClause}.${stopClause}${failureClause}`;

  return [title, description];
}
