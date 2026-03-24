import { createAgentTokenClient } from "@workspace/agent-auth-client";
import {
  DomainIntegrationStatus,
  prisma,
  type PrismaClient,
} from "@hermes/orchestration-database";
import { decryptDomainIntegrationApiKeyWithFallback } from "@hermes/domain-integration-crypto";
import { env } from "@hermes/env";

/** Orchestration DB slice needed for JWT minting (injectable for tests and `orchDb` from expansion context). */
export type DomainIntegrationAuthDb = {
  domainIntegration: Pick<PrismaClient["domainIntegration"], "findFirst">;
};

/**
 * Returns a short-lived JWT for Hermes → registered domain integration HTTP APIs
 * (`POST /api/token` on agent-auth-api), using the decrypted API key for that integration.
 *
 * When **`AGENT_AUTH_API_URL`** is not configured, returns `undefined` (calls may be unauthenticated;
 * domain-api should allow that only in local dev).
 *
 * @param domainIntegrationId - Orchestration `domain_integration.id`.
 * @param options - Optional `db` (defaults to shared orchestration `prisma`).
 * @returns Bearer JWT string, or `undefined` when token issuance is not configured or no ciphertext exists.
 */
export async function getBearerJwtForDomainIntegrationId(
  domainIntegrationId: string,
  options?: { db?: DomainIntegrationAuthDb },
): Promise<string | undefined> {
  const authApiUrl = env.AGENT_AUTH_API_URL?.trim();
  if (!authApiUrl) {
    return undefined;
  }

  const db: DomainIntegrationAuthDb = options?.db ?? {
    domainIntegration: prisma.domainIntegration,
  };
  const row = await db.domainIntegration.findFirst({
    where: {
      id: domainIntegrationId,
      status: DomainIntegrationStatus.active,
      NOT: { encryptedPayload: null },
    },
    select: { encryptedPayload: { select: { ciphertext: true } } },
  });

  const ciphertext = row?.encryptedPayload?.ciphertext;
  if (!ciphertext) {
    return undefined;
  }

  const plaintext = decryptDomainIntegrationApiKeyWithFallback(
    ciphertext,
    env.HERMES_INTERNAL_API_KEY,
    env.HERMES_INTERNAL_API_KEY_PREVIOUS,
  );

  return createAgentTokenClient({
    authApiUrl,
    credential: plaintext,
  }).getToken();
}
