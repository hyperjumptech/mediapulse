"use server";

import { prisma } from "@hermes/orchestration-database";

import { getDashboardSession } from "@/lib/auth-dashboard";
import { createPendingDomainIntegration } from "@/lib/domain-integrations";

export type CreateDomainIntegrationState =
  | { ok: false; error: string }
  | {
      ok: true;
      apiKeyPlaintext: string;
      key: string;
      name: string;
    };

/**
 * Creates a pending domain integration and returns the API key once (for copy UX).
 *
 * @param _prev - Previous action state from `useActionState`.
 * @param formData - Form fields `key` and `name`.
 * @returns Success with plaintext key or error message.
 */
export async function createDomainIntegrationAction(
  _prev: CreateDomainIntegrationState | null,
  formData: FormData,
): Promise<CreateDomainIntegrationState> {
  const session = await getDashboardSession();
  if (!session) {
    return { ok: false, error: "Unauthorized" };
  }

  const key = String(formData.get("key") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!key || !name) {
    return { ok: false, error: "Integration key and name are required." };
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
      key,
      name,
      userId: user.id,
    });
    return {
      ok: true,
      apiKeyPlaintext: result.apiKeyPlaintext,
      key: result.key,
      name: result.name,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create integration.";
    return { ok: false, error: message };
  }
}
