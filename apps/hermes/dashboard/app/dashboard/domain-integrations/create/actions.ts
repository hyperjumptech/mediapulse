"use server";

import { prisma } from "@hermes/orchestration-database";

import { getDashboardSession } from "@/lib/auth-dashboard";
import { createPendingDomainIntegration } from "@/lib/domain-integrations";

export type CreateDomainIntegrationState =
  | { ok: false; error: string }
  | {
      ok: true;
      apiKeyPlaintext: string;
      integrationId: string;
      name: string;
    };

/**
 * Creates a pending domain integration and returns the API key once (for copy UX).
 *
 * @param _prev - Previous action state from `useActionState`.
 * @param formData - Form fields `integrationId` and `name`.
 * @returns Success with plaintext API key or error message.
 */
export async function createDomainIntegrationAction(
  _prev: CreateDomainIntegrationState | null,
  formData: FormData,
): Promise<CreateDomainIntegrationState> {
  const session = await getDashboardSession();
  if (!session) {
    return { ok: false, error: "Unauthorized" };
  }

  const integrationId = String(formData.get("integrationId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!integrationId || !name) {
    return { ok: false, error: "Integration id and name are required." };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.email },
    select: { id: true },
  });
  if (!user) {
    return { ok: false, error: "User not found." };
  }

  try {
    const result = await createPendingDomainIntegration({
      integrationId,
      name,
      userId: user.id,
    });
    return {
      ok: true,
      apiKeyPlaintext: result.apiKeyPlaintext,
      integrationId: result.integrationId,
      name: result.name,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create integration.";
    return { ok: false, error: message };
  }
}
