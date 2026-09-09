import { Context } from "hono";

import {
  getPublishersUnresolvedQuerySchema,
  postPublisherNamesBodySchema,
  postPublishersSeenBodySchema,
} from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";
import { prisma } from "@mediapulse/database";

import {
  listUnresolvedPublishers,
  recordPublisherNames,
  upsertPublishersSeen,
} from "../services/publisher.js";

export async function postPublishersSeen(context: Context): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed = await postPublishersSeenBodySchema.parseAsync(body);
    const result = await upsertPublishersSeen(parsed.publishers, {
      publisher: prisma.publisher,
    });

    return context.json(result, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function getPublishersUnresolved(
  context: Context,
): Promise<Response> {
  try {
    const parsed = await getPublishersUnresolvedQuerySchema.parseAsync(
      context.req.query(),
    );
    const publishers = await listUnresolvedPublishers(parsed.limit, {
      publisher: prisma.publisher,
    });

    return context.json({ publishers }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postPublisherNames(context: Context): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed = await postPublisherNamesBodySchema.parseAsync(body);
    const result = await recordPublisherNames(parsed.publishers, {
      publisher: prisma.publisher,
    });

    return context.json(result, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
