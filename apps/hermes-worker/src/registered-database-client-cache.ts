import {
  decryptRegisteredDatabaseUrl,
  prisma as orchestrationPrisma,
} from "@workspace/orchestration-database";
import {
  PrismaClientWithSchema,
  prisma as defaultMediapulsePrisma,
} from "@workspace/mediapulse-database/client";

type CachedClient = {
  client: PrismaClientWithSchema;
  expiresAt: number;
};

const cache = new Map<string, CachedClient>();
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Returns allowlisted table names for a registered database.
 *
 * @param registeredDatabaseId - Registered database id, or null for default.
 * @returns Table allowlist, or null when unrestricted/default.
 */
export const getRegisteredDatabaseAllowlist = async (
  registeredDatabaseId: string | null,
): Promise<string[] | null> => {
  if (!registeredDatabaseId) return null;

  const registeredDatabase =
    await orchestrationPrisma.registeredDatabase.findUnique({
      where: { id: registeredDatabaseId },
      select: { allowlistedTables: true, isActive: true },
    });

  if (!registeredDatabase || !registeredDatabase.isActive) {
    throw new Error(
      `Registered database ${registeredDatabaseId} is missing or inactive`,
    );
  }

  const rawAllowlist = registeredDatabase.allowlistedTables;
  if (!Array.isArray(rawAllowlist)) return null;
  const allowlistedTables = rawAllowlist.filter(
    (entry): entry is string => typeof entry === "string" && entry.length > 0,
  );

  return allowlistedTables.length > 0 ? allowlistedTables : null;
};

/**
 * Returns a Mediapulse Prisma client for expansion.
 *
 * @param registeredDatabaseId - Registered database id, or null for default client.
 * @returns Prisma client instance.
 */
export const getExpansionPrismaClient = async (
  registeredDatabaseId: string | null,
): Promise<PrismaClientWithSchema> => {
  if (!registeredDatabaseId) {
    return defaultMediapulsePrisma;
  }

  const now = Date.now();
  const cached = cache.get(registeredDatabaseId);
  if (cached && cached.expiresAt > now) {
    return cached.client;
  }

  const registeredDatabase =
    await orchestrationPrisma.registeredDatabase.findUnique({
      where: { id: registeredDatabaseId },
      select: { encryptedConnectionString: true, isActive: true },
    });

  if (!registeredDatabase || !registeredDatabase.isActive) {
    throw new Error(
      `Registered database ${registeredDatabaseId} is missing or inactive`,
    );
  }

  const connectionString = decryptRegisteredDatabaseUrl(
    registeredDatabase.encryptedConnectionString,
  );

  const client = new PrismaClientWithSchema(connectionString);
  cache.set(registeredDatabaseId, {
    client,
    expiresAt: now + CACHE_TTL_MS,
  });

  return client;
};

/**
 * Disconnects cached clients and clears cache.
 */
export const clearRegisteredDatabaseClientCache = async (): Promise<void> => {
  const disconnects = Array.from(cache.values()).map((entry) =>
    entry.client.$disconnect(),
  );
  await Promise.all(disconnects);
  cache.clear();
};
