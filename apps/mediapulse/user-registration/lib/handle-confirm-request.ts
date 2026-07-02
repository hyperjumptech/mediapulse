import { z } from "zod";
import type { RegistrationLanguage } from "@/lib/tickers";
import { checkMemorySlidingRateLimit } from "@/lib/memory-sliding-rate-limit";
import { getClientIpFromRequest } from "@/lib/get-client-ip";
import { requestWebSignup } from "@/lib/request-web-signup";
import {
  sendPendingConfirmationEmailDefault,
  type SendEmail,
} from "@/lib/send-registration-emails";

export { getClientIpFromRequest };

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_PER_IP = 20;
const RATE_LIMIT_MAX_PER_EMAIL = 5;

export const confirmRequestBodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1),
  tickerSymbol: z.string().trim().min(1),
  language: z.enum(["en", "id"]),
});

export const confirmRequestResponseSchema = z.object({
  ok: z.literal(true),
});

export type ConfirmRequestBody = z.infer<typeof confirmRequestBodySchema>;

type ConfirmRequestDeps = {
  requestWebSignup?: typeof requestWebSignup;
  sendPendingConfirmationEmail?: SendEmail;
  checkRateLimit?: typeof checkMemorySlidingRateLimit;
  getClientIp?: (request: Request) => string;
};

/**
 * Handles a web signup confirmation email request.
 * Always returns `{ ok: true }` on valid input to avoid email enumeration.
 *
 * @param body - Parsed signup payload from the registration form.
 * @param request - Incoming HTTP request for rate-limit bucketing.
 * @param deps - Injectable collaborators for tests.
 * @returns Generic success response.
 */
export const handleConfirmRequest = async (
  body: ConfirmRequestBody,
  request: Request,
  deps: ConfirmRequestDeps = {},
): Promise<{ ok: true }> => {
  const requestWebSignupFn = deps.requestWebSignup ?? requestWebSignup;
  const sendPendingConfirmationEmail =
    deps.sendPendingConfirmationEmail ?? sendPendingConfirmationEmailDefault;
  const checkRateLimit = deps.checkRateLimit ?? checkMemorySlidingRateLimit;
  const getClientIp = deps.getClientIp ?? getClientIpFromRequest;

  const clientIp = getClientIp(request);
  const emailKey = body.email.trim().toLowerCase();

  const ipAllowed = checkRateLimit(`confirm-request:ip:${clientIp}`, {
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX_PER_IP,
  });
  const emailAllowed = checkRateLimit(`confirm-request:email:${emailKey}`, {
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX_PER_EMAIL,
  });

  if (!ipAllowed || !emailAllowed) {
    return { ok: true };
  }

  try {
    const signup = await requestWebSignupFn({
      email: emailKey,
      name: body.name,
      tickerSymbol: body.tickerSymbol,
      language: body.language as RegistrationLanguage,
    });

    if (signup.tickerKnown && signup.userTickerId && signup.isNewSubscription) {
      await sendPendingConfirmationEmail({
        to: emailKey,
        name: body.name,
        tickerSymbol: body.tickerSymbol,
        userTickerId: signup.userTickerId,
      });
    }
  } catch {
    // Anti-enumeration: still return ok on downstream failures.
  }

  return { ok: true };
};
