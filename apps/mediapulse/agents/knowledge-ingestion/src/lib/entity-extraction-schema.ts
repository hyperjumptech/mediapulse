import { z } from "zod";

import { KNOWLEDGE_ENTITY_KINDS } from "./knowledge-kinds.js";

/** The longest span a guard can check against an article without the model paraphrasing it. */
export const MAX_EVIDENCE_SPAN_CHARS = 400;

/** Caps on one article's yield, so a listicle cannot fill the graph on its own. */
export const MAX_EXTRACTED_ENTITIES = 12;
export const MAX_EXTRACTED_RELATIONS = 12;

const evidenceSpanSchema = z
  .string()
  .min(10)
  .max(MAX_EVIDENCE_SPAN_CHARS)
  .describe(
    "A sentence copied verbatim from the article. Not a paraphrase, not a summary.",
  );

export const extractedEntitySchema = z.object({
  name: z
    .string()
    .min(2)
    .max(120)
    .describe("The party's fullest name as the article gives it."),
  kind: z.enum(KNOWLEDGE_ENTITY_KINDS),
  surfaceForm: z
    .string()
    .min(2)
    .max(120)
    .describe("The exact spelling the article uses for this party."),
  evidenceSpan: evidenceSpanSchema,
});

export const extractedRelationSchema = z.object({
  subject: z.string().min(2).max(120),
  /**
   * Free text on purpose. The registry of relation kinds is open, so a phrase with no row yet is a
   * new kind rather than an error. A closed enum here would mean the knowledge base can never learn
   * a relationship the seed vocabulary missed.
   */
  kind: z
    .string()
    .min(3)
    .max(60)
    .describe(
      "How the subject relates to the object, in two or three words. Prefer one of the listed kinds.",
    ),
  object: z.string().min(2).max(120),
  evidenceSpan: evidenceSpanSchema,
});

export const entityExtractionSchema = z.object({
  entities: z.array(extractedEntitySchema).max(MAX_EXTRACTED_ENTITIES),
  relations: z.array(extractedRelationSchema).max(MAX_EXTRACTED_RELATIONS),
});

export type ExtractedEntity = z.infer<typeof extractedEntitySchema>;
export type ExtractedRelation = z.infer<typeof extractedRelationSchema>;
export type EntityExtraction = z.infer<typeof entityExtractionSchema>;
