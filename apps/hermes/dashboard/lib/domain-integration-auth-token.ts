import {
  createAgentTokenClient,
  type FetchLike,
} from "@workspace/agent-auth-client";
import {
  DomainIntegrationStatus,
  prisma,
  type Prisma,
  type PrismaClient,
} from "@hermes/orchestration-database";
import { decryptDomainIntegrationApiKeyWithFallback } from "@hermes/domain-integration-crypto";
import { env } from "@hermes/env";

/** Orchestration DB slice needed for JWT minting (injectable for tests and `orchDb` from expansion context). */
export type DomainIntegrationAuthDb = {
  domainIntegration: Pick<PrismaClient["domainIntegration"], "findFirst">;
};

type AgentTokenClient = ReturnType<typeof createAgentTokenClient>;

type CredentialTokenClient = {
  credential: string;
  tokenClient: AgentTokenClient;
};

type DomainIntegrationTokenCacheEntry = {
  authApiUrl: string;
  credentialLoadedAt: number;
  credentialTokenClient: Promise<CredentialTokenClient | undefined>;
  inFlightToken: Promise<string | undefined> | undefined;
};

const CREDENTIAL_RELOAD_INTERVAL_MS = 10 * 60 * 1000;

const TOKEN_REQUEST_TIMEOUT_MS = 5_000;

const domainIntegrationTokenCache = new Map<
  string,
  DomainIntegrationTokenCacheEntry
>();

const isTimeoutError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === "TimeoutError" || error.name === "AbortError");

const fetchTokenWithTimeout: FetchLike = async (url, options) => {
  try {
    return await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      const timeoutSeconds = TOKEN_REQUEST_TIMEOUT_MS / 1000;
      throw new Error(
        `Agent auth API did not respond within ${timeoutSeconds}s`,
        { cause: error },
      );
    }
    throw error;
  }
};

const loadCredential = async (
  domainIntegrationId: string,
  db: DomainIntegrationAuthDb,
): Promise<string | undefined> => {
  const credentialQuery = {
    where: {
      id: domainIntegrationId,
      status: DomainIntegrationStatus.active,
      NOT: { encryptedPayload: null },
    },
    select: { encryptedPayload: { select: { ciphertext: true } } },
  } satisfies Prisma.DomainIntegrationFindFirstArgs;
  const row = await db.domainIntegration.findFirst(credentialQuery);
  const ciphertext = row?.encryptedPayload?.ciphertext;
  if (!ciphertext) {
    return undefined;
  }

  return decryptDomainIntegrationApiKeyWithFallback(
    ciphertext,
    env.HERMES_INTERNAL_API_KEY,
    env.HERMES_INTERNAL_API_KEY_PREVIOUS,
  );
};

const createTokenClient = (
  authApiUrl: string,
  credential: string,
): AgentTokenClient =>
  createAgentTokenClient({
    authApiUrl,
    credential,
    fetchFn: fetchTokenWithTimeout,
  });

const readPreviousTokenClient = async (
  previousEntry: DomainIntegrationTokenCacheEntry | undefined,
  authApiUrl: string,
): Promise<CredentialTokenClient | undefined> => {
  if (!previousEntry || previousEntry.authApiUrl !== authApiUrl) {
    return undefined;
  }

  return previousEntry.credentialTokenClient.catch(() => undefined);
};

const loadCredentialTokenClient = async (
  domainIntegrationId: string,
  authApiUrl: string,
  previousEntry: DomainIntegrationTokenCacheEntry | undefined,
): Promise<CredentialTokenClient | undefined> => {
  const defaultDb: DomainIntegrationAuthDb = {
    domainIntegration: prisma.domainIntegration,
  };
  const credential = await loadCredential(domainIntegrationId, defaultDb);
  if (!credential) {
    return undefined;
  }

  const previousTokenClient = await readPreviousTokenClient(
    previousEntry,
    authApiUrl,
  );
  if (previousTokenClient?.credential === credential) {
    return previousTokenClient;
  }

  const tokenClient = createTokenClient(authApiUrl, credential);

  return { credential, tokenClient };
};

const evictTokenCacheEntry = (
  domainIntegrationId: string,
  entry: DomainIntegrationTokenCacheEntry,
): void => {
  if (domainIntegrationTokenCache.get(domainIntegrationId) === entry) {
    domainIntegrationTokenCache.delete(domainIntegrationId);
  }
};

const resolveTokenCacheEntry = (
  domainIntegrationId: string,
  authApiUrl: string,
): DomainIntegrationTokenCacheEntry => {
  const now = Date.now();
  const existingEntry = domainIntegrationTokenCache.get(domainIntegrationId);
  const credentialIsFresh =
    existingEntry !== undefined &&
    existingEntry.authApiUrl === authApiUrl &&
    now - existingEntry.credentialLoadedAt < CREDENTIAL_RELOAD_INTERVAL_MS;
  if (existingEntry && credentialIsFresh) {
    return existingEntry;
  }

  const entry: DomainIntegrationTokenCacheEntry = {
    authApiUrl,
    credentialLoadedAt: now,
    credentialTokenClient: loadCredentialTokenClient(
      domainIntegrationId,
      authApiUrl,
      existingEntry,
    ),
    inFlightToken: undefined,
  };
  domainIntegrationTokenCache.set(domainIntegrationId, entry);

  return entry;
};

const requestTokenFromCacheEntry = async (
  domainIntegrationId: string,
  entry: DomainIntegrationTokenCacheEntry,
): Promise<string | undefined> => {
  try {
    const credentialTokenClient = await entry.credentialTokenClient;
    if (!credentialTokenClient) {
      evictTokenCacheEntry(domainIntegrationId, entry);

      return undefined;
    }

    return await credentialTokenClient.tokenClient.getToken();
  } catch (error) {
    evictTokenCacheEntry(domainIntegrationId, entry);
    throw error;
  }
};

const getCachedBearerJwt = (
  domainIntegrationId: string,
  authApiUrl: string,
): Promise<string | undefined> => {
  const entry = resolveTokenCacheEntry(domainIntegrationId, authApiUrl);
  if (entry.inFlightToken) {
    return entry.inFlightToken;
  }

  const inFlightToken = requestTokenFromCacheEntry(
    domainIntegrationId,
    entry,
  ).finally(() => {
    if (entry.inFlightToken === inFlightToken) {
      entry.inFlightToken = undefined;
    }
  });
  entry.inFlightToken = inFlightToken;

  return inFlightToken;
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

  if (options?.db) {
    const credential = await loadCredential(domainIntegrationId, options.db);
    if (!credential) {
      return undefined;
    }

    return createTokenClient(authApiUrl, credential).getToken();
  }

  return getCachedBearerJwt(domainIntegrationId, authApiUrl);
}

export const invalidateDomainIntegrationToken = (
  domainIntegrationId: string,
): void => {
  domainIntegrationTokenCache.delete(domainIntegrationId);
};
