/**
 * Extracts a stable client IP for rate limiting from proxy headers.
 *
 * @param request - Incoming HTTP request.
 * @returns Client IP or a fallback bucket key.
 */
export const getClientIpFromRequest = (request: Request): string => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() ?? "unknown";
};
