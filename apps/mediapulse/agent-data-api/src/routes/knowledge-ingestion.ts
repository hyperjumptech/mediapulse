import { Context } from "hono";

import {
  getKnowledgeCandidateSourcesQuerySchema,
  postKnowledgeDevelopmentCitationsBodySchema,
  postKnowledgeDevelopmentsBodySchema,
  postKnowledgeIngestionRunsBodySchema,
  postKnowledgeIngestionRunsFinishBodySchema,
  postKnowledgeStorylineCandidatesBodySchema,
  postKnowledgeStorylinesBodySchema,
} from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";
import { prisma } from "@mediapulse/database";

import {
  citeKnowledgeDevelopment,
  finishKnowledgeIngestionRun,
  findKnowledgeStorylineCandidates,
  listKnowledgeCandidateSources,
  openKnowledgeDevelopment,
  openKnowledgeStoryline,
  startKnowledgeIngestionRun,
} from "../services/knowledge-ingestion.js";

export async function getKnowledgeCandidateSources(
  context: Context,
): Promise<Response> {
  try {
    const parsed = await getKnowledgeCandidateSourcesQuerySchema.parseAsync(
      context.req.query(),
    );
    const result = await listKnowledgeCandidateSources(
      parsed.since,
      parsed.take,
      prisma,
      parsed.fromStart,
    );

    return context.json(result, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postKnowledgeStorylineCandidates(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed =
      await postKnowledgeStorylineCandidatesBodySchema.parseAsync(body);
    const result = await findKnowledgeStorylineCandidates(
      parsed.anchors,
      prisma,
    );

    return context.json(result, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postKnowledgeStorylines(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed = await postKnowledgeStorylinesBodySchema.parseAsync(body);
    const result = await openKnowledgeStoryline(parsed, prisma);

    return context.json(result, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postKnowledgeDevelopments(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed = await postKnowledgeDevelopmentsBodySchema.parseAsync(body);
    const result = await openKnowledgeDevelopment(parsed, prisma);

    return context.json(result, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postKnowledgeDevelopmentCitations(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed =
      await postKnowledgeDevelopmentCitationsBodySchema.parseAsync(body);
    const result = await citeKnowledgeDevelopment(parsed, prisma);

    return context.json(result, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postKnowledgeIngestionRuns(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed = await postKnowledgeIngestionRunsBodySchema.parseAsync(body);
    const result = await startKnowledgeIngestionRun(parsed, prisma);

    return context.json(result, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postKnowledgeIngestionRunsFinish(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed =
      await postKnowledgeIngestionRunsFinishBodySchema.parseAsync(body);
    await finishKnowledgeIngestionRun(parsed, prisma);

    return context.json({ message: "Ingestion run recorded" }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
