import { Context } from "hono";

import {
  getKnowledgeExtractionCandidatesQuerySchema,
  postKnowledgeExtractionRunsBodySchema,
  postKnowledgeExtractionRunsFinishBodySchema,
  postKnowledgeExtractionSeedBodySchema,
  postKnowledgeExtractionsBodySchema,
  SEED_RELATION_KINDS,
} from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";
import { prisma } from "@mediapulse/database";

import {
  applyExtraction,
  finishExtractionRun,
  listExtractionCandidates,
  seedKnowledgeBaseFromProfile,
  startExtractionRun,
} from "../services/knowledge-extraction.js";

export async function getKnowledgeExtractionCandidates(
  context: Context,
): Promise<Response> {
  try {
    const parsed = await getKnowledgeExtractionCandidatesQuerySchema.parseAsync(
      context.req.query(),
    );
    const result = await listExtractionCandidates(prisma, parsed);
    if (result === null) {
      return context.json({ message: "Ticker not found" }, 404);
    }

    return context.json(result, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postKnowledgeExtractionSeed(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed = await postKnowledgeExtractionSeedBodySchema.parseAsync(body);
    const result = await seedKnowledgeBaseFromProfile(
      prisma,
      parsed.tickerId,
      parsed.extractionRunId,
      SEED_RELATION_KINDS,
    );
    if (result === null) {
      return context.json({ message: "Ticker not found" }, 404);
    }

    return context.json(result, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postKnowledgeExtractions(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed = await postKnowledgeExtractionsBodySchema.parseAsync(body);
    const result = await applyExtraction(prisma, parsed);

    return context.json(result, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postKnowledgeExtractionRuns(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed = await postKnowledgeExtractionRunsBodySchema.parseAsync(body);
    const result = await startExtractionRun(prisma, parsed);

    return context.json(result, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postKnowledgeExtractionRunsFinish(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed =
      await postKnowledgeExtractionRunsFinishBodySchema.parseAsync(body);
    await finishExtractionRun(prisma, parsed);

    return context.json({ ok: true as const }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
