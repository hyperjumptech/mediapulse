import { env } from "@mediapulse/env/app-user-registration";

type UnsubscribeStatus =
  | "unsubscribed"
  | "already_unsubscribed"
  | "not_found"
  | "invalid"
  | "expired";

type UnsubscribeResponse = {
  status: UnsubscribeStatus;
  displaySymbol?: string;
};

/**
 * Renders browser-friendly unsubscribe response pages.
 *
 * @param body - Inner HTML message.
 * @returns HTML response.
 */
const htmlResponse = (body: string): Response =>
  new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MediaPulse</title></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:40px auto;padding:0 16px;color:#1a1a1a">${body}</body></html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );

/**
 * Calls agent-data-api unsubscribe endpoint.
 *
 * @param token - Signed unsubscribe token.
 * @param method - Origin interaction method for audit.
 * @returns Parsed API response.
 */
const requestUnsubscribe = async (
  token: string,
  method: "link" | "one_click",
): Promise<UnsubscribeResponse> => {
  const endpoint = `${env.AGENT_DATA_API_URL.replace(/\/$/, "")}/api/v1/user-registration-unsubscribe`;

  if (method === "link") {
    const response = await fetch(
      `${endpoint}?token=${encodeURIComponent(token)}`,
      { method: "GET", cache: "no-store" },
    );
    if (!response.ok) {
      throw new Error(
        `Unsubscribe lookup failed with status ${response.status}`,
      );
    }
    return (await response.json()) as UnsubscribeResponse;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) {
    throw new Error(`Unsubscribe update failed with status ${response.status}`);
  }
  return (await response.json()) as UnsubscribeResponse;
};

/**
 * Maps API statuses to browser-readable HTML messages.
 *
 * @param data - Unsubscribe result from agent-data-api.
 * @returns HTML response.
 */
const toBrowserHtml = (data: UnsubscribeResponse): Response => {
  if (data.status === "unsubscribed") {
    return htmlResponse(
      `<p style="font-size:18px;font-weight:600;margin-bottom:8px">Unsubscribed</p><p style="color:#6b7280">You have been unsubscribed from <strong>${data.displaySymbol ?? "this ticker"}</strong> updates.</p>`,
    );
  }
  if (data.status === "already_unsubscribed") {
    return htmlResponse(
      `<p style="color:#6b7280">You are already unsubscribed from ${data.displaySymbol ?? "this ticker"} updates.</p>`,
    );
  }
  if (data.status === "expired") {
    return htmlResponse(
      `<p style="color:#6b7280">This unsubscribe link has expired. Please contact support or reply to this email.</p>`,
    );
  }
  if (data.status === "invalid") {
    return htmlResponse(
      `<p style="color:#6b7280">This unsubscribe link is invalid. Please contact support or reply to this email.</p>`,
    );
  }
  return htmlResponse(
    `<p style="color:#6b7280">We couldn't find this subscription. It may have already been removed.</p>`,
  );
};

/**
 * Handles browser unsubscribe links.
 */
export const GET = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";

  try {
    const result = await requestUnsubscribe(token, "link");
    return toBrowserHtml(result);
  } catch {
    return htmlResponse(
      `<p style="color:#6b7280">Unsubscribe is temporarily unavailable. Please try again later.</p>`,
    );
  }
};

/**
 * Handles RFC 8058 one-click unsubscribe requests.
 */
export const POST = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";

  try {
    await requestUnsubscribe(token, "one_click");
    return new Response(null, { status: 200 });
  } catch {
    return new Response(null, { status: 200 });
  }
};
