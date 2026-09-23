import { z } from "zod";

import {
  buildExtractionMessages,
  extractionArticleText,
  type BuildExtractionMessagesInput,
} from "./build-extraction-messages.js";
import {
  entityExtractionSchema,
  MAX_EVIDENCE_SPAN_CHARS,
  MAX_EXTRACTED_ENTITIES,
  MAX_EXTRACTED_RELATIONS,
} from "./entity-extraction-schema.js";
import { KNOWLEDGE_ENTITY_KINDS } from "./knowledge-kinds.js";

export const MARKET_PARTY_KINDS = [
  "company",
  "brand",
  "regulator",
  "government",
] as const;

export const LEGACY_SYSTEM_PROMPT = [
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

export const NO_PERSON_KIND_SYSTEM_PROMPT = [
  "You read one news article about an Indonesian listed company and record the organisations that make up its market, and the commercial or regulatory links the article states between them.",
  "",
  "Record only these kinds of party:",
  "- company: a business, listed or private, Indonesian or foreign",
  "- brand: a trading name or store chain a company operates",
  "- regulator: a supervisory body such as OJK, BPOM, BEI or Bank Indonesia",
  "- government: a ministry, agency or state body",
  "- other: an industry association, exchange, fund or similar body",
  "",
  "Never record a person. Executives, analysts, ministers, journalists, investors and public figures are not parties, whatever the article says about them. When a person is named, record the organisation they act for instead, and only when the article names that organisation.",
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

const frozenEntitySchema = (kinds: readonly [string, ...string[]]) =>
  z.object({
    entities: z
      .array(
        z.object({
          name: z.string().min(2).max(120),
          kind: z.enum(kinds),
          surfaceForm: z.string().min(2).max(120),
          evidenceSpan: z.string().min(10).max(MAX_EVIDENCE_SPAN_CHARS),
        }),
      )
      .max(MAX_EXTRACTED_ENTITIES),
    relations: z
      .array(
        z.object({
          subject: z.string().min(2).max(120),
          kind: z.string().min(3).max(60),
          object: z.string().min(2).max(120),
          evidenceSpan: z.string().min(10).max(MAX_EVIDENCE_SPAN_CHARS),
        }),
      )
      .max(MAX_EXTRACTED_RELATIONS),
  });

export const legacyExtractionSchema = frozenEntitySchema(
  KNOWLEDGE_ENTITY_KINDS,
);

export const noPersonKindExtractionSchema = frozenEntitySchema([
  "company",
  "brand",
  "regulator",
  "government",
  "other",
]);

const candidateBlock = (
  candidates: BuildExtractionMessagesInput["candidates"],
): string => {
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

const buildUserMessage = (input: BuildExtractionMessagesInput): string =>
  [
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

const buildFrozenMessages =
  (system: string) => (input: BuildExtractionMessagesInput) => [
    { role: "system" as const, content: system },
    { role: "user" as const, content: buildUserMessage(input) },
  ];

export const buildLegacyExtractionMessages =
  buildFrozenMessages(LEGACY_SYSTEM_PROMPT);

export const buildNoPersonKindMessages = buildFrozenMessages(
  NO_PERSON_KIND_SYSTEM_PROMPT,
);

export const PROMPT_VARIANTS = {
  "v0-legacy": {
    label: "prompt and vocabulary as they ran before any of this",
    schema: legacyExtractionSchema,
    vocabulary: "observed",
    build: buildLegacyExtractionMessages,
  },
  "v1-curated-vocab": {
    label: "legacy prompt, curated vocabulary only",
    schema: legacyExtractionSchema,
    vocabulary: "curated",
    build: buildLegacyExtractionMessages,
  },
  "v2-no-person-kind": {
    label: "market-party prompt that forbade the person kind outright",
    schema: noPersonKindExtractionSchema,
    vocabulary: "curated",
    build: buildNoPersonKindMessages,
  },
  "v3-production": {
    label: "current production prompt and schema, person labelled then dropped",
    schema: entityExtractionSchema,
    vocabulary: "curated",
    build: buildExtractionMessages,
  },
} as const;

export type PromptVariantKey = keyof typeof PROMPT_VARIANTS;
