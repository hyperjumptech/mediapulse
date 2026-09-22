import { z } from "zod";

/** Articles handed to one extraction call. */
export const KNOWLEDGE_EXTRACTION_MAX_TAKE = 500;

/** Entities one article may contribute, matching the extraction schema's own cap. */
export const KNOWLEDGE_EXTRACTION_MAX_ENTITIES = 12;

/** Relations one article may contribute. */
export const KNOWLEDGE_EXTRACTION_MAX_RELATIONS = 12;

/** Longest evidence span stored, which is also the longest one a guard can check. */
export const KNOWLEDGE_EXTRACTION_MAX_SPAN_CHARS = 400;

export const knowledgeEntityKindSchema = z.enum([
  "issuer",
  "company",
  "brand",
  "regulator",
  "government",
  "person",
  "product",
  "place",
  "other",
]);

export const knowledgeFactSourceSchema = z.enum([
  "profile",
  "extracted",
  "operator",
]);

export const getKnowledgeExtractionCandidatesQuerySchema = z.object({
  /** Extraction is per issuer: an entity's relevance is a per-ticker fact. */
  tickerId: z.string().uuid(),
  since: z.string().datetime().optional(),
  fromStart: z
    .union([z.boolean(), z.string()])
    .transform((value) => value === true || value === "true")
    .optional(),
  take: z
    .union([z.number(), z.string()])
    .transform((value) =>
      typeof value === "number" ? value : Number.parseInt(value, 10),
    )
    .pipe(z.number().int().positive().max(KNOWLEDGE_EXTRACTION_MAX_TAKE))
    .optional(),
});

/** One party the issuer's profile already names, offered to extraction as a preferred spelling. */
export const knowledgeCandidatePartySchema = z.object({
  name: z.string(),
  aliases: z.array(z.string()),
  kind: knowledgeEntityKindSchema,
});

export const knowledgeCandidateArticleSchema = z.object({
  dataSourceId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  content: z.string().nullable(),
  observedAt: z.string(),
});

export const getKnowledgeExtractionCandidatesResponseSchema = z.object({
  issuer: z.object({
    tickerId: z.string(),
    symbol: z.string(),
    name: z.string(),
    aliases: z.array(z.string()),
    companyOverview: z.string().nullable(),
  }),
  parties: z.array(knowledgeCandidatePartySchema),
  /** Relation kinds already in the registry, offered as the preferred vocabulary. */
  relationKindLabels: z.array(z.string()),
  articles: z.array(knowledgeCandidateArticleSchema),
  watermark: z.string().nullable(),
  resumedFrom: z.string().nullable(),
});

export const postKnowledgeExtractionSeedBodySchema = z.object({
  tickerId: z.string().uuid(),
  extractionRunId: z.string().uuid().nullable(),
});

export const postKnowledgeExtractionSeedResponseSchema = z.object({
  issuerEntityId: z.string(),
  entitiesCreated: z.number().int().nonnegative(),
  relationsOpened: z.number().int().nonnegative(),
  relationsConfirmed: z.number().int().nonnegative(),
});

export const knowledgeExtractedEntitySchema = z.object({
  name: z.string().min(2),
  kind: knowledgeEntityKindSchema,
  surfaceForm: z.string().min(2),
  evidenceSpan: z.string().max(KNOWLEDGE_EXTRACTION_MAX_SPAN_CHARS),
});

export const knowledgeExtractedRelationSchema = z.object({
  subject: z.string().min(2),
  /** Free text: the relation-kind registry is open, so a new phrase is a new kind, not an error. */
  kind: z.string().min(3),
  object: z.string().min(2),
  evidenceSpan: z.string().max(KNOWLEDGE_EXTRACTION_MAX_SPAN_CHARS),
});

export const postKnowledgeExtractionsBodySchema = z.object({
  tickerId: z.string().uuid(),
  dataSourceId: z.string().uuid(),
  extractionRunId: z.string().uuid().nullable(),
  entities: z
    .array(knowledgeExtractedEntitySchema)
    .max(KNOWLEDGE_EXTRACTION_MAX_ENTITIES),
  relations: z
    .array(knowledgeExtractedRelationSchema)
    .max(KNOWLEDGE_EXTRACTION_MAX_RELATIONS),
});

export const knowledgeExtractionRejectionSchema = z.object({
  reason: z.enum([
    "span-not-in-text",
    "name-not-in-text",
    "endpoint-unknown",
    "self-relation",
    "person",
  ]),
  detail: z.string(),
});

export const postKnowledgeExtractionsResponseSchema = z.object({
  entitiesCreated: z.number().int().nonnegative(),
  mentionsWritten: z.number().int().nonnegative(),
  relationsOpened: z.number().int().nonnegative(),
  relationsConfirmed: z.number().int().nonnegative(),
  kindsCreated: z.number().int().nonnegative(),
  rejected: z.array(knowledgeExtractionRejectionSchema),
});

export const postKnowledgeExtractionRunsBodySchema = z.object({
  tickerId: z.string().uuid().nullable(),
  scheduleExecutionId: z.string().nullable(),
  agentVersion: z.string().nullable(),
  startedAt: z.string().datetime(),
});

export const postKnowledgeExtractionRunsResponseSchema = z.object({
  extractionRunId: z.string(),
});

export const postKnowledgeExtractionRunsFinishBodySchema = z.object({
  extractionRunId: z.string().uuid(),
  status: z.enum(["success", "partial_success", "failed"]),
  completedAt: z.string().datetime(),
  watermarkAt: z.string().datetime().nullable(),
  considered: z.number().int().nonnegative(),
  skippedNoCandidates: z.number().int().nonnegative(),
  entitiesCreated: z.number().int().nonnegative(),
  relationsOpened: z.number().int().nonnegative(),
  relationsConfirmed: z.number().int().nonnegative(),
  mentionsWritten: z.number().int().nonnegative(),
  kindsCreated: z.number().int().nonnegative(),
  rejectedSpanNotInText: z.number().int().nonnegative(),
  rejectedNameNotInText: z.number().int().nonnegative(),
  rejectedPerson: z.number().int().nonnegative().default(0),
  stopReason: z.string().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
});

export const postKnowledgeExtractionRunsFinishResponseSchema = z.object({
  ok: z.literal(true),
});

export type KnowledgeEntityKindName = z.infer<typeof knowledgeEntityKindSchema>;
export type KnowledgeFactSourceName = z.infer<typeof knowledgeFactSourceSchema>;
export type KnowledgeCandidateParty = z.infer<
  typeof knowledgeCandidatePartySchema
>;
export type KnowledgeCandidateArticle = z.infer<
  typeof knowledgeCandidateArticleSchema
>;
export type GetKnowledgeExtractionCandidatesQuery = z.infer<
  typeof getKnowledgeExtractionCandidatesQuerySchema
>;
export type GetKnowledgeExtractionCandidatesResponse = z.infer<
  typeof getKnowledgeExtractionCandidatesResponseSchema
>;
export type PostKnowledgeExtractionSeedBody = z.infer<
  typeof postKnowledgeExtractionSeedBodySchema
>;
export type PostKnowledgeExtractionSeedResponse = z.infer<
  typeof postKnowledgeExtractionSeedResponseSchema
>;
export type KnowledgeExtractedEntity = z.infer<
  typeof knowledgeExtractedEntitySchema
>;
export type KnowledgeExtractedRelation = z.infer<
  typeof knowledgeExtractedRelationSchema
>;
export type PostKnowledgeExtractionsBody = z.infer<
  typeof postKnowledgeExtractionsBodySchema
>;
export type PostKnowledgeExtractionsResponse = z.infer<
  typeof postKnowledgeExtractionsResponseSchema
>;
export type KnowledgeExtractionRejection = z.infer<
  typeof knowledgeExtractionRejectionSchema
>;
export type PostKnowledgeExtractionRunsBody = z.infer<
  typeof postKnowledgeExtractionRunsBodySchema
>;
export type PostKnowledgeExtractionRunsResponse = z.infer<
  typeof postKnowledgeExtractionRunsResponseSchema
>;
export type PostKnowledgeExtractionRunsFinishBody = z.infer<
  typeof postKnowledgeExtractionRunsFinishBodySchema
>;

/** A relation kind the registry is seeded with, and the phrasings that resolve to it. */
export type SeedRelationKind = {
  slug: string;
  label: string;
  inverseLabel: string | null;
  symmetric: boolean;
  /** Phrasings that read subject to object. */
  aliases: readonly string[];
  /** Phrasings that read object to subject, stored so the endpoints can be swapped on resolution. */
  invertedAliases: readonly string[];
};

/**
 * The relation kinds the registry starts with.
 *
 * The registry is open, so this is a starting vocabulary and not a closed set: extraction may add a
 * kind it has no row for. Seeding these keeps the common cases from forking into a dozen near
 * duplicates on the first run.
 */
export const SEED_RELATION_KINDS: readonly SeedRelationKind[] = [
  {
    slug: "competes_with",
    label: "competes with",
    inverseLabel: null,
    symmetric: true,
    aliases: [
      "competes with",
      "competitor of",
      "competitor",
      "rival of",
      "rival",
      "kompetitor",
      "pesaing",
      "bersaing dengan",
    ],
    invertedAliases: [],
  },
  {
    slug: "regulates",
    label: "regulates",
    inverseLabel: "regulated by",
    symmetric: false,
    aliases: ["regulates", "regulator of", "oversees", "mengatur", "mengawasi"],
    invertedAliases: [
      "regulated by",
      "supervised by",
      "diatur oleh",
      "diawasi oleh",
    ],
  },
  {
    slug: "supplies",
    label: "supplies",
    inverseLabel: "supplied by",
    symmetric: false,
    aliases: ["supplies", "supplier of", "memasok", "pemasok"],
    invertedAliases: ["supplied by", "buys from", "dipasok oleh"],
  },
  {
    slug: "distributes_for",
    label: "distributes for",
    inverseLabel: "distributed by",
    symmetric: false,
    aliases: ["distributes for", "distributor of", "mendistribusikan"],
    invertedAliases: ["distributed by", "didistribusikan oleh"],
  },
  {
    slug: "partners_with",
    label: "partners with",
    inverseLabel: null,
    symmetric: true,
    aliases: [
      "partners with",
      "partnership with",
      "collaborates with",
      "bermitra dengan",
      "berkolaborasi dengan",
      "kerja sama dengan",
    ],
    invertedAliases: [],
  },
  {
    slug: "owns_stake_in",
    label: "owns a stake in",
    inverseLabel: "part-owned by",
    symmetric: false,
    aliases: [
      "owns a stake in",
      "owns",
      "acquired",
      "mengakuisisi",
      "memiliki saham",
    ],
    invertedAliases: [
      "owned by",
      "part-owned by",
      "dimiliki oleh",
      "diakuisisi oleh",
    ],
  },
  {
    slug: "subsidiary_of",
    label: "is a subsidiary of",
    inverseLabel: "parent of",
    symmetric: false,
    aliases: ["subsidiary of", "unit of", "anak usaha", "anak perusahaan dari"],
    invertedAliases: ["parent of", "induk dari"],
  },
  {
    slug: "operates_brand",
    label: "operates the brand",
    inverseLabel: "operated by",
    symmetric: false,
    aliases: [
      "operates the brand",
      "operates",
      "runs",
      "mengoperasikan",
      "pemegang lisensi",
    ],
    invertedAliases: ["operated by", "dioperasikan oleh"],
  },
];
