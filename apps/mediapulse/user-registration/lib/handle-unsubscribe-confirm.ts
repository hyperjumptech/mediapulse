import { z } from "zod";
import { checkMemorySlidingRateLimit } from "@/lib/memory-sliding-rate-limit";
import { getClientIpFromRequest } from "@/lib/get-client-ip";
import {
  requestUnsubscribe,
  type UnsubscribeResponse,
} from "@/lib/unsubscribe-api";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_PER_IP = 30;

export const unsubscribeConfirmBodySchema = z.object({
  token: z.string().trim().min(1),
});

export const unsubscribeConfirmResponseSchema = z.object({
  status: z.enum([
    "unsubscribed",
    "already_unsubscribed",
    "not_found",
    "invalid",
    "expired",
  ]),
  displaySymbol: z.string().optional(),
});

export type UnsubscribeConfirmBody = z.infer<
  typeof unsubscribeConfirmBodySchema
>;

type UnsubscribeConfirmDeps = {
  requestUnsubscribe?: typeof requestUnsubscribe;
  checkRateLimit?: typeof checkMemorySlidingRateLimit;
  getClientIp?: (request: Request) => string;
};

/**
 * Performs a user-confirmed unsubscribe (`method: "link"`).
 *
 * This runs only after the user clicks Confirm on the confirmation page, so it is the
 * point at which the subscription is actually disabled.
 *
 * @param body - Parsed request body containing the signed token.
 * @param request - Incoming HTTP request for rate-limit bucketing.
 * @param deps - Injectable collaborators for tests.
 * @returns The unsubscribe outcome and display symbol.
 */
export const handleUnsubscribeConfirm = async (
  body: UnsubscribeConfirmBody,
  request: Request,
  deps: UnsubscribeConfirmDeps = {},
): Promise<UnsubscribeResponse> => {
  const requestUnsubscribeFn = deps.requestUnsubscribe ?? requestUnsubscribe;
  const checkRateLimit = deps.checkRateLimit ?? checkMemorySlidingRateLimit;
  const getClientIp = deps.getClientIp ?? getClientIpFromRequest;

  const clientIp = getClientIp(request);
  const ipAllowed = checkRateLimit(`unsubscribe-confirm:ip:${clientIp}`, {
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX_PER_IP,
  });

  if (!ipAllowed) {
    return { status: "invalid" };
  }

  return requestUnsubscribeFn(body.token, "link");
};
