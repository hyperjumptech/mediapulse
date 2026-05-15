import { NextResponse } from "next/server";

import { validateApiKey } from "@/lib/mcp-api-keys";

/**
 * Parses `Authorization: Bearer <token>` from a request.
 *
 * @param request - Incoming HTTP request.
 * @returns Bearer token or null.
 */
const parseBearerToken = (request: Request): string | null => {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
};

/**
 * GET /api/mcp/whoami — returns MCP key metadata for Bearer auth (no secrets).
 */
export async function GET(request: Request) {
  const token = parseBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const validated = await validateApiKey(token);
  if (!validated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    label: validated.label,
    readOnly: validated.readOnly,
    keyId: validated.id,
    user: { id: validated.createdByUserId },
  });
}
