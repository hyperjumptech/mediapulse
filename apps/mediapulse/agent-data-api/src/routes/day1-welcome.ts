import { Context } from "hono";

import { prisma as mediapulsePrisma } from "@mediapulse/database";
import { internalError } from "@workspace/api-utils";
import {
  day1WelcomeClaimBodySchema,
  getDay1WelcomeQuerySchema,
  getDay1WelcomeResponseSchema,
  postDay1WelcomeBodySchema,
  postDay1WelcomeClaimReleaseResponseSchema,
  postDay1WelcomeClaimResponseSchema,
  postDay1WelcomeResponseSchema,
} from "@workspace/agent-data-api-contract";
import {
  claimDay1Welcome,
  recordDay1WelcomeSent,
  releaseDay1WelcomeClaim,
} from "../services/day1-welcome-claim.js";
import { getDay1Welcome } from "../services/day1-welcome.js";

export async function getDay1WelcomeHandler(
  context: Context,
): Promise<Response> {
  try {
    const query = getDay1WelcomeQuerySchema.parse(context.req.query());
    const result = await getDay1Welcome(mediapulsePrisma, query);
    const response = getDay1WelcomeResponseSchema.parse(result);

    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postDay1WelcomeHandler(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await postDay1WelcomeBodySchema.parseAsync(body);
    await recordDay1WelcomeSent(mediapulsePrisma, data);
    const response = postDay1WelcomeResponseSchema.parse({
      message: "Success",
    });

    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postDay1WelcomeClaimHandler(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await day1WelcomeClaimBodySchema.parseAsync(body);
    const result = await claimDay1Welcome(mediapulsePrisma, data);
    const response = postDay1WelcomeClaimResponseSchema.parse(result);

    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postDay1WelcomeClaimReleaseHandler(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await day1WelcomeClaimBodySchema.parseAsync(body);
    const result = await releaseDay1WelcomeClaim(mediapulsePrisma, data);
    const response = postDay1WelcomeClaimReleaseResponseSchema.parse(result);

    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
