/**
 * Resolves the public origin for redirects when `request.url` reflects the
 * container bind address (e.g. `0.0.0.0:3001`) instead of the browser host.
 * Reverse proxies (Fly, etc.) send `x-forwarded-host` and `x-forwarded-proto`.
 *
 * @param request - Incoming request.
 * @returns Base URL origin (`https://…`) suitable for `new URL(path, origin)`.
 */
export const resolvePublicOrigin = (request: Request): string => {
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  if (!forwardedHost) {
    return new URL(request.url).origin;
  }
  const forwardedProto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https";
  return `${forwardedProto}://${forwardedHost}`;
};
