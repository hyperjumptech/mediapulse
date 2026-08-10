import { Context } from "hono";

import {
  postPublisherAuthorityBodySchema,
  postPublisherAuthorityStaleBodySchema,
} from "@workspace/agent-data-api-contract";
import { internalError } from "@workspace/api-utils";
import { prisma } from "@mediapulse/database";

import {
  lookupStalePublisherAuthorityDomains,
  recordPublisherAuthority,
} from "../services/publisher-authority.js";

export async function postPublisherAuthorityStale(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed = await postPublisherAuthorityStaleBodySchema.parseAsync(body);
    const domains = await lookupStalePublisherAuthorityDomains(
      parsed.domains,
      parsed.ttlDays,
      prisma.domainAuthority,
    );

    return context.json({ domains }, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postPublisherAuthority(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const parsed = await postPublisherAuthorityBodySchema.parseAsync(body);
    const recordedCount = await recordPublisherAuthority(parsed, {
      domainAuthority: prisma.domainAuthority,
    });

    return context.json(
      { message: "Publisher authority recorded", recordedCount },
      200,
    );
  } catch (error) {
    return internalError(context, error);
  }
}
