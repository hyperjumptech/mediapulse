import { Context } from "hono";

import { prisma as mediapulsePrisma } from "@mediapulse/database";
import { internalError } from "@workspace/api-utils";
import {
  getOrganonIngestionCandidatesQuerySchema,
  getOrganonIngestionCandidatesResponseSchema,
  getOrganonIngestionSendsQuerySchema,
  getOrganonIngestionSendsResponseSchema,
  postOrganonIngestionEvidenceChecksBodySchema,
  postOrganonIngestionEvidenceChecksResponseSchema,
  postOrganonIngestionRetriesBodySchema,
  postOrganonIngestionRetriesResponseSchema,
  postOrganonIngestionSendsBodySchema,
  postOrganonIngestionSendsResponseSchema,
} from "@workspace/agent-data-api-contract";
import {
  claimOrganonIngestionRetries,
  listOrganonIngestionCandidates,
  listOrganonIngestionSends,
  markOrganonIngestionEvidenceChecked,
  recordOrganonIngestionSends,
} from "../services/organon-ingestion.js";

export async function getOrganonIngestionCandidatesHandler(
  context: Context,
): Promise<Response> {
  try {
    const query = getOrganonIngestionCandidatesQuerySchema.parse(
      context.req.query(),
    );
    const result = await listOrganonIngestionCandidates(
      mediapulsePrisma,
      query,
    );
    const response = getOrganonIngestionCandidatesResponseSchema.parse(result);

    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function getOrganonIngestionSendsHandler(
  context: Context,
): Promise<Response> {
  try {
    const query = getOrganonIngestionSendsQuerySchema.parse(
      context.req.query(),
    );
    const result = await listOrganonIngestionSends(mediapulsePrisma, query);
    const response = getOrganonIngestionSendsResponseSchema.parse(result);

    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postOrganonIngestionSendsHandler(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const sends = await postOrganonIngestionSendsBodySchema.parseAsync(body);
    const result = await recordOrganonIngestionSends(mediapulsePrisma, sends);
    const response = postOrganonIngestionSendsResponseSchema.parse(result);

    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postOrganonIngestionRetriesHandler(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await postOrganonIngestionRetriesBodySchema.parseAsync(body);
    const result = await claimOrganonIngestionRetries(mediapulsePrisma, data);
    const response = postOrganonIngestionRetriesResponseSchema.parse(result);

    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postOrganonIngestionEvidenceChecksHandler(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const data =
      await postOrganonIngestionEvidenceChecksBodySchema.parseAsync(body);
    const result = await markOrganonIngestionEvidenceChecked(
      mediapulsePrisma,
      data,
    );
    const response =
      postOrganonIngestionEvidenceChecksResponseSchema.parse(result);

    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
