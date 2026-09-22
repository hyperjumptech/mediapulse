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
import { z } from "zod";

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

export const legacyExtractionSchema = z.object({
  entities: z
    .array(
      z.object({
        name: z.string().min(2).max(120),
        kind: z.enum(KNOWLEDGE_ENTITY_KINDS),
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

export const buildLegacyExtractionMessages = (
  input: BuildExtractionMessagesInput,
) => {
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
    { role: "system" as const, content: LEGACY_SYSTEM_PROMPT },
    { role: "user" as const, content: user },
  ];
};

export const PROMPT_VARIANTS = {
  "v0-legacy": {
    label: "prompt and vocabulary as they ran before this change",
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
  "v2-focused": {
    label: "current production prompt and schema",
    schema: entityExtractionSchema,
    vocabulary: "curated",
    build: buildExtractionMessages,
  },
} as const;

export type PromptVariantKey = keyof typeof PROMPT_VARIANTS;
