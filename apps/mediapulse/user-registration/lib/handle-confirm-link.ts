import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import { env } from "@mediapulse/env/app-user-registration";
import { sendRegistrationConfirmedEmailDefault } from "@/lib/send-registration-emails";

type SendConfirmedEmail = typeof sendRegistrationConfirmedEmailDefault;

type ConfirmSubscriptionResult = {
  status: "confirmed" | "already_confirmed" | "invalid" | "expired";
  displaySymbol?: string;
  email?: string;
};

type CreateClient = typeof createAgentDataApiClient;

/**
 * Renders browser-friendly HTML responses.
 *
 * @param body - Inner HTML message.
 * @returns HTML response.
 */
export const htmlResponse = (body: string): Response =>
  new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MediaPulse</title></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:40px auto;padding:0 16px;color:#1a1a1a">${body}</body></html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );

/**
 * Calls agent-data-api confirm-subscription endpoint.
 *
 * @param token - Signed confirmation token.
 * @param createClient - Injected SDK factory for tests.
 * @returns Parsed API response.
 */
export const requestConfirmSubscription = async (
  token: string,
  createClient: CreateClient = createAgentDataApiClient,
): Promise<ConfirmSubscriptionResult> => {
  const client = createClient({
    baseUrl: env.AGENT_DATA_API_URL,
    version: "v1",
  });

  return client.userRegistrationConfirmSubscription.get({ token });
};

/**
 * Maps API statuses to browser-readable HTML messages.
 *
 * @param data - Confirm result from agent-data-api.
 * @returns HTML response.
 */
export const toConfirmBrowserHtml = (
  data: ConfirmSubscriptionResult,
): Response => {
  if (data.status === "confirmed") {
    return htmlResponse(
      `<p style="font-size:18px;font-weight:600;margin-bottom:8px">Subscription confirmed</p><p style="color:#6b7280">You are now subscribed to <strong>${data.displaySymbol ?? "this ticker"}</strong> updates. Check your inbox for a welcome email with our contact card.</p>`,
    );
  }
  if (data.status === "already_confirmed") {
    return htmlResponse(
      `<p style="color:#6b7280">Your subscription to ${data.displaySymbol ?? "this ticker"} is already confirmed.</p>`,
    );
  }
  if (data.status === "expired") {
    return htmlResponse(
      `<p style="color:#6b7280">This confirmation link has expired. Please subscribe again from the MediaPulse registration page.</p>`,
    );
  }
  if (data.status === "invalid") {
    return htmlResponse(
      `<p style="color:#6b7280">This confirmation link is invalid. Please subscribe again from the MediaPulse registration page.</p>`,
    );
  }
  return htmlResponse(
    `<p style="color:#6b7280">We couldn't confirm this subscription. Please try again later.</p>`,
  );
};

type HandleConfirmLinkDeps = {
  requestConfirmSubscription?: typeof requestConfirmSubscription;
  sendRegistrationConfirmedEmail?: SendConfirmedEmail;
};

/**
 * Confirms a subscription from a browser link and sends the welcome email when newly confirmed.
 *
 * @param token - Signed confirmation token from the query string.
 * @param deps - Injectable collaborators for tests.
 * @returns HTML response for the browser.
 */
export const handleConfirmLink = async (
  token: string,
  deps: HandleConfirmLinkDeps = {},
): Promise<Response> => {
  const requestConfirmSubscriptionFn =
    deps.requestConfirmSubscription ?? requestConfirmSubscription;
  const sendRegistrationConfirmedEmail =
    deps.sendRegistrationConfirmedEmail ??
    sendRegistrationConfirmedEmailDefault;

  if (!token.trim()) {
    return htmlResponse(
      `<p style="color:#6b7280">This confirmation link is invalid. Please subscribe again from the MediaPulse registration page.</p>`,
    );
  }

  try {
    const result = await requestConfirmSubscriptionFn(token);

    if (result.status === "confirmed" && result.email && result.displaySymbol) {
      await sendRegistrationConfirmedEmail({
        to: result.email,
        tickerSymbol: result.displaySymbol,
      });
    }

    return toConfirmBrowserHtml(result);
  } catch {
    return htmlResponse(
      `<p style="color:#6b7280">Confirmation is temporarily unavailable. Please try again later.</p>`,
    );
  }
};

export type { ConfirmSubscriptionResult };
