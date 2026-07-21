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
    `Planning searches for ${subject.symbol}`,
    `Working out what to search for ${subject.symbol} (${subject.name}).`,
  ];
}

export function narrativeDiscovery(
  subject: TickerSubject,
  cacheHit: boolean,
): [string, string] {
  return [
    "Mapping the competitive landscape",
    cacheHit
      ? `Reusing the known competitors and regulators for ${subject.symbol}.`
      : `Identifying the competitors and regulators that shape ${subject.symbol}'s market.`,
  ];
}

export function narrativeGenerating(
  subject: TickerSubject,
  queriesPerIntent: number,
  intentCount: number,
): [string, string] {
  return [
    "Drafting search queries",
    `Writing ${n(queriesPerIntent, "query", "queries")} for each of the ${String(intentCount)} newsletter sections that ${subject.symbol} feeds.`,
  ];
}

export function narrativeProbing(candidateCount: number): [string, string] {
  return [
    "Testing which queries return results",
    `Running ${n(candidateCount, "draft query", "draft queries")} against the search providers to see which ones actually find articles.`,
  ];
}

export function narrativeRunComplete(
  subject: TickerSubject,
  opts: {
    queryCount: number;
    queriesPerIntent: number;
    perIntent: Record<string, number>;
    attempts: number;
    zeroYieldCount: number;
  },
): [string, string] {
  const shortIntents = Object.entries(opts.perIntent)
    .filter(([, count]) => count < opts.queriesPerIntent)
    .map(([intent]) => intent);

  const savedClause = `Saved ${n(opts.queryCount, "search query", "search queries")} for ${subject.symbol}`;

  const notes: string[] = [];
  if (opts.attempts > 1) {
    notes.push(`took ${n(opts.attempts, "attempt")}`);
  }
  if (opts.zeroYieldCount > 0) {
    notes.push(`${opts.zeroYieldCount} returned nothing when tested`);
  }
  const noteClause = notes.length > 0 ? ` (${joinClauses(notes)})` : "";

  const shortfallClause =
    shortIntents.length > 0
      ? ` Short of the ${String(opts.queriesPerIntent)}-query target for ${joinClauses(shortIntents)}.`
      : "";

  return [
    "Search plan ready",
    `${savedClause}${noteClause}.${shortfallClause}`,
  ];
}
