/**
 * Parses `Authorization: Bearer <token>` from a request.
 *
 * @param request - Incoming HTTP request.
 * @returns Bearer token or null when missing or malformed.
 */
export const parseBearerToken = (request: Request): string | null => {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
};
