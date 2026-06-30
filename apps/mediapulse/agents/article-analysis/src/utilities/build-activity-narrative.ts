function n(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

export type AnalysisStopReason =
  | "drained"
  | "max_pairs_reached"
  | "no_progress"
  | "nothing_to_do"
  | null;

export function narrativeRunStart(backlog: number): [string, string] {
  return [
    "Analyzing articles",
    backlog > 0
      ? `Found ${n(backlog, "article awaiting classification", "articles awaiting classification")} and starting to score them.`
      : "Checking for articles awaiting classification.",
  ];
}

export function narrativeClassifying(
  batchCount: number,
  processed: number,
  backlog: number,
): [string, string] {
  const progress =
    backlog > 0
      ? ` (${Math.min(processed, backlog)} of ${backlog} so far)`
      : "";

  return [
    "Classifying articles",
    `Scoring ${n(batchCount, "article")} against the acceptance criteria${progress}.`,
  ];
}

export function narrativeRunComplete(opts: {
  status: "success" | "partial_success" | "failed";
  scored: number;
  assigned: number;
  rejected: number;
  failureCount: number;
  stopReason: AnalysisStopReason;
}): [string, string] {
  const title =
    opts.status === "failed" ? "Analysis failed" : "Analysis complete";

  if (opts.status === "failed") {
    return [title, "No articles could be classified this run."];
  }

  const scoredClause =
    opts.scored === 0
      ? "No articles needed classification"
      : `Classified ${n(opts.scored, "article")}: assigned ${n(opts.assigned, "article")} across sections, ${opts.rejected} rejected`;

  let stopClause = "";
  if (opts.stopReason === "drained") {
    stopClause = " The backlog was fully drained.";
  } else if (opts.stopReason === "max_pairs_reached") {
    stopClause =
      " The per-run limit was reached; the rest is left for the next run.";
  } else if (opts.stopReason === "no_progress") {
    stopClause = " Classification stalled, so the run stopped early.";
  }

  const failureClause =
    opts.failureCount > 0
      ? ` ${n(opts.failureCount, "classification error")} recorded.`
      : "";

  const description = `${scoredClause}.${stopClause}${failureClause}`;

  return [title, description];
}
