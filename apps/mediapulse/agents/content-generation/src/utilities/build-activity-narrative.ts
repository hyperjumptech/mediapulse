export type TickerSubject = { symbol: string; name: string };

function n(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

export function narrativeRunStart(subject: TickerSubject): [string, string] {
  return [
    `Generating newsletter for ${subject.symbol}`,
    `Loading analyzed articles for ${subject.symbol} (${subject.name}).`,
  ];
}

export function narrativeGenerating(
  subject: TickerSubject,
  articleCount: number,
): [string, string] {
  return [
    "Writing the newsletter",
    `Drafting from ${n(articleCount, "analyzed article")} across sections for ${subject.symbol}.`,
  ];
}

export function narrativeRunComplete(
  subject: TickerSubject,
  opts: {
    status: "success" | "skipped" | "failed";
    itemsWritten: number;
    sectionsFilled: number;
    translationLanguages: string[];
    reason?: string | null;
  },
): [string, string] {
  if (opts.status === "skipped") {
    return [
      "Skipped",
      `A newsletter for ${subject.symbol} already exists today.`,
    ];
  }

  if (opts.status === "failed") {
    const reason = opts.reason ?? "Newsletter generation failed.";
    return ["Newsletter failed", reason];
  }

  const translationClause =
    opts.translationLanguages.length > 0
      ? `; generated ${n(opts.translationLanguages.length, "translation")} (${opts.translationLanguages.join(", ")})`
      : "";

  const description = `Wrote ${n(opts.itemsWritten, "item")} across ${n(opts.sectionsFilled, "section")} for ${subject.symbol}${translationClause}.`;

  return ["Newsletter complete", description];
}
