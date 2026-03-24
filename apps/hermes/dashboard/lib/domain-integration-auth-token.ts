import { createAgentTokenClient } from "@workspace/agent-auth-client";
import {
  DomainIntegrationStatus,
  prisma,
} from "@hermes/orchestration-database";
import { decryptDomainIntegrationApiKeyWithFallback } from "@hermes/domain-integration-crypto";
import { env } from "@hermes/env";

/**
 * Returns a short-lived JWT for Hermes → registered domain integration HTTP APIs
 * (`POST /api/token` on agent-auth-api), using the decrypted API key for that integration.
 *
 * When **`AGENT_AUTH_API_URL`** is not configured, returns `undefined` (calls may be unauthenticated;
 * domain-api should allow that only in local dev).
 *
 * @param domainIntegrationId - Orchestration `domain_integration.id`.
 * @returns Bearer JWT string, or `undefined` when token issuance is not configured or no ciphertext exists.
 */
export async function getBearerJwtForDomainIntegrationId(
  domainIntegrationId: string,
): Promise<string | undefined> {
  const authApiUrl = env.AGENT_AUTH_API_URL?.trim();
  if (!authApiUrl) {
    return undefined;
  }

  const row = await prisma.domainIntegration.findFirst({
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
