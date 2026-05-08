import { Context } from "hono";
import { internalError } from "@workspace/api-utils";
import { env } from "@mediapulse/env";
import {
  postUserRegistrationRegisterBodySchema,
  postUserRegistrationRegisterResponseSchema,
  postUserRegistrationConfirmBodySchema,
  postUserRegistrationConfirmResponseSchema,
  postUserRegistrationUnsubscribeBodySchema,
  userRegistrationUnsubscribeQuerySchema,
  userRegistrationUnsubscribeResponseSchema,
} from "@workspace/agent-data-api-contract";
import {
  processRegistration,
  confirmRegistration,
  processUnsubscribe,
} from "../services/user-registration.js";

export async function postUserRegistrationRegisterHandler(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await postUserRegistrationRegisterBodySchema.parseAsync(body);
    const result = await processRegistration(data);
    const response = postUserRegistrationRegisterResponseSchema.parse(result);
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postUserRegistrationConfirmHandler(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const data = await postUserRegistrationConfirmBodySchema.parseAsync(body);
    const result = await confirmRegistration(data);
    const response = postUserRegistrationConfirmResponseSchema.parse(result);
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function getUserRegistrationUnsubscribeHandler(
  context: Context,
): Promise<Response> {
  try {
    const query = userRegistrationUnsubscribeQuerySchema.parse(
      context.req.query(),
    );
    const result = await processUnsubscribe({
      token: query.token,
      secret: env.UNSUBSCRIBE_SECRET,
      method: "link",
    });
    const response = userRegistrationUnsubscribeResponseSchema.parse(result);
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}

export async function postUserRegistrationUnsubscribeHandler(
  context: Context,
): Promise<Response> {
  try {
    const body = await context.req.json();
    const data =
      await postUserRegistrationUnsubscribeBodySchema.parseAsync(body);
    const result = await processUnsubscribe({
      token: data.token,
      secret: env.UNSUBSCRIBE_SECRET,
      method: "one_click",
    });
    const response = userRegistrationUnsubscribeResponseSchema.parse(result);
    return context.json(response, 200);
  } catch (error) {
    return internalError(context, error);
  }
}
