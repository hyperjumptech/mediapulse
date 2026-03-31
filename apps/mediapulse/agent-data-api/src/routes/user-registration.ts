import { Context } from "hono";
import { internalError } from "@workspace/api-utils";
import {
  postUserRegistrationRegisterBodySchema,
  postUserRegistrationRegisterResponseSchema,
  postUserRegistrationConfirmBodySchema,
  postUserRegistrationConfirmResponseSchema,
} from "@workspace/agent-data-api-contract";
import {
  processRegistration,
  confirmRegistration,
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
