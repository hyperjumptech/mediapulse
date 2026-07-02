import { requestUnsubscribe } from "@/lib/unsubscribe-api";

/**
 * Handles browser unsubscribe links.
 *
 * The click no longer unsubscribes. It redirects to the confirmation page, which shows a
 * Confirm button before any change is made. This also prevents email link scanners that
 * prefetch the footer link (GET) from silently unsubscribing recipients.
 */
export const GET = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const lang = url.searchParams.get("lang");

  const target = new URL("/unsubscribe", url.origin);
  if (token) {
    target.searchParams.set("token", token);
  }
  if (lang) {
    target.searchParams.set("lang", lang);
  }

  return Response.redirect(target, 303);
};

/**
 * Handles RFC 8058 one-click unsubscribe requests.
 *
 * Mail clients (Gmail, Apple Mail) POST here directly, so this must remain a single-step
 * unsubscribe with no confirmation.
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
