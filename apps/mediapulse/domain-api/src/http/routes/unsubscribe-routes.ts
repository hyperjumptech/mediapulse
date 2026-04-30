import { Hono } from "hono";
import { verifyUnsubscribeToken } from "@workspace/utils";
import { env } from "@mediapulse/env";
import { prisma } from "@mediapulse/database";

export const unsubscribeRoutes = new Hono();

/**
 * Renders a minimal HTML response for browser-based unsubscribe clicks.
 *
 * @param body - Inner HTML for the body element.
 * @param status - HTTP status (always 200 for email-client compatibility).
 */
function htmlResponse(body: string, status = 200): Response {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MediaPulse</title></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:40px auto;padding:0 16px;color:#1a1a1a">${body}</body></html>`,
    {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

/**
 * Core unsubscribe logic shared by GET and POST.
 *
 * Verifies the HMAC token, flips `UserTicker.enabled` to `false`,
 * and records `unsubscribedAt` / `unsubscribeMethod` for audit.
 *
 * @param token - The signed token from the URL query parameter.
 * @param method - `"link"` for GET or `"one_click"` for POST.
 */
async function handleUnsubscribe(
  token: string,
  method: "link" | "one_click",
): Promise<Response> {
  const secret = env.UNSUBSCRIBE_SECRET;
  if (!secret) {
    // Misconfigured environment — return 200-safe per RFC 8058
    if (method === "one_click") {
      return new Response(null, { status: 200 });
    }
    return htmlResponse(
      `<p style="color:#6b7280">Unsubscribe is temporarily unavailable. Please try again later.</p>`,
    );
  }

  const result = verifyUnsubscribeToken(token, secret);

  if (!result.valid) {
    if (method === "one_click") {
      // RFC 8058: POST returns empty 200 regardless
      return new Response(null, { status: 200 });
    }
    const message =
      result.reason === "expired"
        ? "This unsubscribe link has expired. Please contact support or reply to this email."
        : "This unsubscribe link is invalid. Please contact support or reply to this email.";
    return htmlResponse(`<p style="color:#6b7280">${message}</p>`);
  }

  // Look up the UserTicker with its Ticker for display
  const userTicker = await prisma.userTicker.findUnique({
    where: { id: result.userTickerId },
    include: { ticker: true },
  });

  // Use DB ticker symbol if available, fall back to token-embedded symbol
  const displaySymbol = userTicker?.ticker?.symbol ?? result.tickerSymbol;

  if (!userTicker) {
    if (method === "one_click") {
      return new Response(null, { status: 200 });
    }
    return htmlResponse(
      `<p style="color:#6b7280">We couldn't find this subscription. It may have already been removed.</p>`,
    );
  }

  // Idempotent: already unsubscribed via self-service
  if (!userTicker.enabled && userTicker.unsubscribedAt != null) {
    if (method === "one_click") {
      return new Response(null, { status: 200 });
    }
    return htmlResponse(
      `<p style="color:#6b7280">You are already unsubscribed from ${displaySymbol} updates.</p>`,
    );
  }

  // Perform the unsubscribe
  await prisma.userTicker.update({
    where: { id: result.userTickerId },
    data: {
      enabled: false,
      unsubscribedAt: new Date(),
      unsubscribeMethod: method,
    },
  });

  if (method === "one_click") {
    return new Response(null, { status: 200 });
  }

  return htmlResponse(
    `<p style="font-size:18px;font-weight:600;margin-bottom:8px">Unsubscribed</p><p style="color:#6b7280">You have been unsubscribed from <strong>${displaySymbol}</strong> updates.</p>`,
  );
}

unsubscribeRoutes.get("/unsubscribe", (c) => {
  const token = c.req.query("token") ?? "";
  return handleUnsubscribe(token, "link");
});

unsubscribeRoutes.post("/unsubscribe", (c) => {
  const token = c.req.query("token") ?? "";
  return handleUnsubscribe(token, "one_click");
});

export { handleUnsubscribe };
