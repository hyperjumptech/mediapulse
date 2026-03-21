import { verifyApiKeyViaAuthApi } from "@workspace/agent-auth-client";
import {
  registerDomainIntegrationRequestSchema,
  registerDomainIntegrationResponseSchema,
} from "@workspace/hermes-domain-contract";
import { env } from "@workspace/env";
import { NextResponse } from "next/server";
import { registerDomainIntegration } from "@/lib/domain-integrations";

const getToken = (request: Request): string | null => {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const [scheme, value] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) return null;
  return value;
};

/**
 * Registers or refreshes a domain integration in Hermes.
 *
 * @param request - Incoming request containing integration metadata.
 * @returns Registration response with stored integration values.
 */
export async function POST(request: Request) {
  if (!env.AGENT_AUTH_API_URL) {
    return NextResponse.json(
      { message: "AGENT_AUTH_API_URL is required" },
      { status: 500 },
    );
  }

  const token = getToken(request);
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const verified = await verifyApiKeyViaAuthApi(token, env.AGENT_AUTH_API_URL);
  if (!verified) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = registerDomainIntegrationRequestSchema.safeParse(
    await request.json(),
  );
  if (!body.success) {
    return NextResponse.json(
      { message: "Invalid request body", issues: body.error.flatten() },
      { status: 400 },
    );
  }

  const registered = await registerDomainIntegration(body.data);
  return NextResponse.json(
    registerDomainIntegrationResponseSchema.parse(registered),
  );
}
