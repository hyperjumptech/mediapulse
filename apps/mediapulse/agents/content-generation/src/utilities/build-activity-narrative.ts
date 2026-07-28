export type TickerSubject = { symbol: string; name: string };

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  id: "Indonesian",
};

function n(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

function joinClauses(parts: string[]): string {
  if (parts.length <= 1) {
    return parts.join("");
  }

  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function languageName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code;
}

export function narrativeRunStart(subject: TickerSubject): [string, string] {
  return [
    `Generating newsletter for ${subject.symbol}`,
    `Checking whether ${subject.symbol} (${subject.name}) already has a newsletter today.`,
  ];
}

export function narrativeSourcesLoaded(
  subject: TickerSubject,
  articleCount: number,
): [string, string] {
  return [
    "Reading the analyzed articles",
    articleCount > 0
      ? `Loaded ${n(articleCount, "analyzed article")} for ${subject.symbol}.`
      : `No analyzed articles are waiting for ${subject.symbol}.`,
  ];
}

export function narrativeTriage(
  subject: TickerSubject,
  candidateCount: number,
): [string, string] {
  return [
    "Choosing what to read in full",
    `Deciding which of ${n(candidateCount, "article")} for ${subject.symbol} need their full text.`,
  ];
}

export function narrativeFetching(
  subject: TickerSubject,
  requestCount: number,
): [string, string] {
  return [
    "Fetching article text",
    `Downloading the full text of ${n(requestCount, "article")} for ${subject.symbol}.`,
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

export function narrativeSaving(subject: TickerSubject): [string, string] {
  return [
    "Saving the newsletter",
    `Storing the finished newsletter for ${subject.symbol}.`,
  ];
}

export function narrativeTranslating(languages: string[]): [string, string] {
  const names = languages.map(languageName);

  return [
    "Translating the newsletter",
    `Writing the ${joinClauses(names)} ${names.length === 1 ? "edition" : "editions"} for subscribers who read in ${names.length === 1 ? "that language" : "those languages"}.`,
  ];
}

export function narrativeRunComplete(
  subject: TickerSubject,
  opts: {
    status: "success" | "skipped" | "no_sources" | "failed";
    itemsWritten: number;
    sectionsFilled: number;
    translationLanguages: string[];
    articlesRead?: number;
    repeatsDropped?: number;
    sectionsRemoved?: number;
    reason?: string | null;
  },
): [string, string] {
  if (opts.status === "skipped") {
    return [
      "Skipped",
      `A newsletter for ${subject.symbol} already exists today.`,
    ];
  }

  if (opts.status === "no_sources") {
    return [
      "Nothing to write",
      `${subject.symbol} has no analyzed articles to write from yet.`,
    ];
  }

  if (opts.status === "failed") {
    const reason = opts.reason ?? "Newsletter generation failed.";

    return ["Newsletter failed", reason];
  }

  const wroteClause = `Wrote ${n(opts.itemsWritten, "item")} across ${n(opts.sectionsFilled, "section")} for ${subject.symbol}`;

  const detailParts: string[] = [];
  if (opts.articlesRead !== undefined && opts.articlesRead > 0) {
    detailParts.push(`read ${n(opts.articlesRead, "article")} in full`);
  }
  if (opts.repeatsDropped !== undefined && opts.repeatsDropped > 0) {
    detailParts.push(
      `dropped ${n(opts.repeatsDropped, "story", "stories")} already covered in an earlier issue`,
    );
  }
  if (opts.translationLanguages.length > 0) {
    const names = opts.translationLanguages.map(languageName);
    detailParts.push(
      `added ${joinClauses(names)} ${names.length === 1 ? "translation" : "translations"}`,
    );
  }
  const detailClause =
    detailParts.length > 0 ? `; ${joinClauses(detailParts)}` : "";

  const removedClause =
    opts.sectionsRemoved !== undefined && opts.sectionsRemoved > 0
      ? ` ${n(opts.sectionsRemoved, "section")} had too little material and ${opts.sectionsRemoved === 1 ? "was" : "were"} left out.`
      : "";

  return [
    "Newsletter complete",
    `${wroteClause}${detailClause}.${removedClause}`,
  ];
}
