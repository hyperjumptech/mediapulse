import type { ModelMessage } from "ai";

/** Longest article body the prompt carries, matching what article-analysis sends. */
export const MAX_ARTICLE_CHARS = 12_000;

/** One party the issuer's profile already names, offered to the model as a preferred spelling. */
export type CandidateParty = {
  name: string;
  aliases: readonly string[];
  kind: "company" | "regulator";
};

export type ExtractionArticle = {
  title: string;
  description: string | null;
  content: string | null;
};

export type ExtractionIssuer = {
  symbol: string;
  name: string;
  aliases: readonly string[];
  companyOverview: string | null;
};

export type BuildExtractionMessagesInput = {
  article: ExtractionArticle;
  issuer: ExtractionIssuer;
  candidates: readonly CandidateParty[];
  relationKindLabels: readonly string[];
};

/**
 * The article text the guards check an evidence span against.
 *
 * - Important: the prompt and the guards must read the same string. If the prompt saw a longer
 *   article than the guard does, a faithful quote from the tail would be rejected as invented.
 *
 * @param article - Title, description and body.
 * @returns The text as one block, truncated to {@link MAX_ARTICLE_CHARS}.
 */
export const extractionArticleText = (article: ExtractionArticle): string => {
  const parts = [
    article.title,
    article.description ?? "",
    article.content ?? "",
  ];

  return parts.join("\n\n").slice(0, MAX_ARTICLE_CHARS);
};

export const EXTRACTION_SYSTEM_PROMPT = [
  "You read one news article about an Indonesian listed company and record the organisations that make up its market, and the commercial or regulatory links the article states between them.",
  "",
  "Record only these kinds of party:",
  "- company: a business, listed or private, Indonesian or foreign",
  "- brand: a trading name or store chain a company operates",
  "- regulator: a supervisory body such as OJK, BPOM, BEI or Bank Indonesia",
  "- government: a ministry, agency or state body",
  "- other: an industry association, exchange, fund or similar body",
  "- person: a named individual, reported only so it can be discarded",
  "",
  "A person is not part of an issuer's market. Executives, analysts, ministers, journalists, investors and public figures do not belong in the graph, and when a person is named you should record the organisation they act for instead, and only when the article names that organisation.",
  "If you do report a person anyway, you must set kind to `person`. Never file a person as a company, a brand, a government body or other. A person reported as `person` is discarded cleanly; a person disguised as a company corrupts the graph.",
  "Never record a product, a place, a market index, a currency, an amount or an abstract concept.",
  "Record a party only when the article puts it in this issuer's market: it trades with, competes with, owns, supplies, regulates or is owned by the issuer or another party in the article. A company named only as a comparison, a data point or background colour is not.",
  "",
  "Relations:",
  "- A relation is a standing commercial or regulatory link between two organisations you recorded: competition, ownership, supply, distribution, partnership, regulation.",
  "- Somebody saying, leading, appointing, supporting, praising, visiting or commenting on something is not a relation. Neither is an organisation reporting a number.",
  "- Two parties named in the same sentence or the same list is not a relation.",
  "- Prefer the relation kinds listed below. Use a short phrase of your own only when the article states a link none of them covers.",
  "- Write the relation in its natural direction: a regulator regulates a company, a parent owns a subsidiary.",
  "",
  "Evidence:",
  "- Every evidenceSpan must be a sentence copied from the article character for character. A paraphrase is rejected.",
  "- Report nothing the article does not name. Do not use what you know from elsewhere.",
  "",
  "An empty list is the right answer when the article names no party in this issuer's market. Most routine articles yield one or two parties, not twelve.",
  "",
  "Skip the issuer's own name in `entities`. It is already known.",
].join("\n");

const candidateBlock = (candidates: readonly CandidateParty[]): string => {
  if (candidates.length === 0) {
    return "None on file.";
  }

  return candidates
    .map((candidate) => {
      const aliases = candidate.aliases.filter(
        (alias) => alias !== candidate.name,
      );
      const seenAs =
        aliases.length === 0 ? "" : ` (also written: ${aliases.join(", ")})`;

      return `- ${candidate.name} [${candidate.kind}]${seenAs}`;
    })
    .join("\n");
};

/**
 * Builds the messages for one article's entity and relation extraction.
 *
 * @param input - The article, the issuer, the parties already on file, and the known relation kinds.
 * @returns Messages for `generateObject`.
 */
export const buildExtractionMessages = (
  input: BuildExtractionMessagesInput,
): ModelMessage[] => {
  const system = EXTRACTION_SYSTEM_PROMPT;

  const user = [
    `Issuer being read for: ${input.issuer.symbol} — ${input.issuer.name}`,
    input.issuer.aliases.length === 0
      ? ""
      : `Also written: ${input.issuer.aliases.join(", ")}`,
    input.issuer.companyOverview === null
      ? ""
      : `What it does: ${input.issuer.companyOverview}`,
    "",
    "Parties already on file for this issuer (prefer these names and spellings):",
    candidateBlock(input.candidates),
    "",
    `Relation kinds already in use: ${input.relationKindLabels.join(", ")}`,
    "",
    "Article:",
    extractionArticleText(input.article),
  ]
    .filter((line) => line !== "")
    .join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
};
