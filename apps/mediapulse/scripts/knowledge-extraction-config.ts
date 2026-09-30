import type { Prisma } from "@hermes/orchestration-database";
import type { PrismaClientWithSchema } from "@hermes/orchestration-database/client";

export const AGENT_ID = "knowledge-ingestion";
export const AGENT_VERSION = "1.0.0";

export const REQUIRED_VARIABLE_KEYS = ["AI_API_KEY", "AI_BASE_URL"] as const;

export const EXTRACTION_MODEL = "google/gemini-2.5-flash-lite";

export type KnowledgeExtractionVariableDb = Pick<
  PrismaClientWithSchema,
  "variable"
>;

export const knowledgeExtractionConfig = (): Prisma.InputJsonValue => ({
  model: EXTRACTION_MODEL,
  apiKey: "{{AI_API_KEY}}",
  baseUrl: "{{AI_BASE_URL}}",
});

export const findMissingVariableKeys = async (
  db: KnowledgeExtractionVariableDb,
): Promise<string[]> => {
  const present = await db.variable.findMany({
    where: { key: { in: [...REQUIRED_VARIABLE_KEYS] } },
    select: { key: true },
  });
  const presentKeys = new Set(present.map((variable) => variable.key));

  return REQUIRED_VARIABLE_KEYS.filter((key) => !presentKeys.has(key));
};
