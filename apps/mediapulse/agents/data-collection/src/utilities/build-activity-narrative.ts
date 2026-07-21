export type TickerSubject = { symbol: string; name: string };

function n(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

/** Joins clauses as `a`, `a and b`, or `a, b and c`. */
function joinClauses(parts: string[]): string {
  if (parts.length <= 1) {
    return parts.join("");
  }

  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export function narrativeRunStart(subject: TickerSubject): [string, string] {
  return [
    `Collecting news for ${subject.symbol}`,
    `Loading search queries and context for ${subject.symbol} (${subject.name}).`,
  ];
}

export function narrativeSearching(
  subject: TickerSubject,
  queryCount: number,
): [string, string] {
  return [
    "Searching the web",
    `Running ${n(queryCount, "search query", "search queries")} for ${subject.symbol}.`,
  ];
}

export function narrativeFetching(subject: TickerSubject): [string, string] {
  return [
    "Screening results",
    `Checking search results for ${subject.symbol} against the freshness, relevance, and article-shape gates.`,
  ];
}

export function narrativeRunComplete(
  subject: TickerSubject,
  opts: {
    status: "success" | "partial_success" | "failed";
    persisted: number;
    droppedByFreshness: number;
    droppedByRelevance: number;
    droppedByNonArticleUrl: number;
    droppedByThinDescription: number;
    droppedByDuplicate: number;
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
    dropParts.push(`${opts.droppedByRelevance} never mentioned the ticker`);
  }
  if (opts.droppedByNonArticleUrl > 0) {
    dropParts.push(`${opts.droppedByNonArticleUrl} were not articles`);
  }
  if (opts.droppedByFreshness > 0) {
    dropParts.push(`${opts.droppedByFreshness} were stale`);
  }
  if (opts.droppedByThinDescription > 0) {
    dropParts.push(`${opts.droppedByThinDescription} had too little text`);
  }
  if (opts.droppedByDuplicate > 0) {
    dropParts.push(`${opts.droppedByDuplicate} were duplicates`);
  }

  const dropClause =
    dropParts.length > 0 ? `; dropped ${joinClauses(dropParts)}` : "";

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
  } else if (opts.stopReason === "no_queries") {
    stopClause = ` No active search queries were configured.`;
  } else if (opts.stopReason === "wall_clock_exceeded") {
    stopClause = ` The run reached its time budget and stopped early.`;
  }

  const failureClause =
    opts.failureCount > 0
      ? ` ${opts.failureCount} fetch error${opts.failureCount === 1 ? "" : "s"} recorded.`
      : "";

  const description = `${savedClause}${dropClause}.${stopClause}${failureClause}`;

  return [title, description];
}
