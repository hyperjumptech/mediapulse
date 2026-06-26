function n(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

export function narrativeRunStart(total: number): [string, string] {
  return [
    "Analyzing articles",
    `Loading ${n(total, "unanalyzed article")} to classify.`,
  ];
}

export function narrativeClassifying(count: number): [string, string] {
  return [
    "Classifying articles",
    `Scoring ${n(count, "article")} against the acceptance criteria.`,
  ];
}

export function narrativeRunComplete(opts: {
  status: "success" | "failed";
  scored: number;
  assigned: number;
  rejected: number;
}): [string, string] {
  const title =
    opts.status === "failed" ? "Analysis failed" : "Analysis complete";

  if (opts.status === "failed") {
    return [title, "No articles could be classified this run."];
  }

  const description =
    opts.scored === 0
      ? "No unanalyzed articles were available."
      : `Scored ${n(opts.scored, "article")}; assigned ${n(opts.assigned, "article")} across sections; ${n(opts.rejected, "article")} rejected.`;

  return [title, description];
}
