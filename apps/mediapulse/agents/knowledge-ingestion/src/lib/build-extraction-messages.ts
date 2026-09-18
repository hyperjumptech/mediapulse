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
  const system = [
    "You read one news article and report the organisations, brands, regulators and people it names, and how they relate to each other.",
    "",
    "Rules:",
    "1. Report a party only when the article names it. Never report a party the article merely implies, and never one you know about from elsewhere.",
    "2. Every evidenceSpan must be a sentence copied character for character from the article. A paraphrase is rejected.",
    "3. Report a relation only when a sentence states it. Two parties appearing in the same article, or in the same list, is not a relation.",
    "4. Prefer the relation kinds listed below. Use a short phrase of your own only when none of them fits.",
    "5. Write a relation in its natural direction and say it plainly: a regulator regulates a company, a parent owns a subsidiary.",
    "6. Skip the issuer's own name in `entities`. It is already known.",
  ].join("\n");

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
