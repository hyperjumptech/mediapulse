import { type Prisma, prisma, UserRole } from "@hermes/orchestration-database";
import { env } from "@hermes/env";
import * as crypto from "node:crypto";

/** Prefix for MCP API key plaintext (`hmcp_<publicId>_<secret>`). */
export const MCP_API_KEY_PREFIX = "hmcp" as const;

/** Result of a successful {@link validateApiKey} call (no secrets). */
export type ValidatedMcpApiKey = {
  id: string;
  label: string;
  readOnly: boolean;
  createdByUserId: string;
};

export type CreateMcpApiKeyInput = {
  label: string;
  readOnly: boolean;
  createdByUserId: string;
};

export type CreateMcpApiKeyResult = {
  id: string;
  label: string;
  readOnly: boolean;
  createdByUserId: string;
  /** Full Bearer token; show once to the operator. */
  apiKeyPlaintext: string;
};

type McpApiKeyDb = Pick<
  typeof prisma.mcpApiKey,
  "findFirst" | "create" | "update" | "findMany"
> & {
  findUnique: Pick<typeof prisma.mcpApiKey, "findUnique">["findUnique"];
};

type UserDb = Pick<typeof prisma.user, "findUnique">;

type HashMcpApiKeyDependencies = {
  pepper?: string;
};

type ValidateMcpApiKeyDependencies = {
  db?: McpApiKeyDb;
  userDb?: UserDb;
  pepper?: string;
};

type CreateMcpApiKeyDependencies = ValidateMcpApiKeyDependencies;

type RevokeMcpApiKeyDependencies = {
  db?: Pick<typeof prisma.mcpApiKey, "updateMany">;
};

type TouchMcpApiKeyLastUsedDependencies = {
  db?: Pick<typeof prisma.mcpApiKey, "update">;
};

/**
 * Builds the peppered input string hashed for MCP API key storage.
 *
 * @param plaintext - Raw Bearer token.
 * @param pepper - Server secret from env.
 * @returns Bytes fed to SHA-256.
 */
export const buildMcpApiKeyHashInput = (
  plaintext: string,
  pepper: string,
): string => `${pepper}${plaintext}`;

/**
 * Returns SHA-256 hex of the peppered MCP API key (storage format).
 *
 * @param plaintext - Raw Bearer token.
 * @param dependencies - Injectable pepper (default: {@link env.HERMES_MCP_API_KEY_PEPPER}).
 * @returns Lowercase hex digest.
 */
export const hashMcpApiKey = (
  plaintext: string,
  { pepper = env.HERMES_MCP_API_KEY_PEPPER }: HashMcpApiKeyDependencies = {},
): string => {
  return crypto
    .createHash("sha256")
    .update(buildMcpApiKeyHashInput(plaintext, pepper))
    .digest("hex");
};

/**
 * Constant-time comparison of two equal-length hex strings.
 *
 * @param a - First hex digest.
 * @param b - Second hex digest.
 * @returns Whether digests match.
 */
export const timingSafeEqualHex = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
};

/**
 * Generates a new MCP API key plaintext (`hmcp_<id>_<secret>`).
 *
 * @returns Public id segment and full plaintext token.
 */
export const generateMcpApiKeyPlaintext = (): {
  publicId: string;
  apiKeyPlaintext: string;
} => {
  const publicId = crypto.randomBytes(6).toString("base64url");
  const secret = crypto.randomBytes(32).toString("base64url");
  const apiKeyPlaintext = `${MCP_API_KEY_PREFIX}_${publicId}_${secret}`;
  return { publicId, apiKeyPlaintext };
};

const defaultFindActiveKeyByHash = async (
  keyHash: string,
  db: McpApiKeyDb,
): Promise<{
  id: string;
  label: string;
  readOnly: boolean;
  createdByUserId: string;
  ownerCredentialVersion: number;
  revokedAt: Date | null;
} | null> => {
  const args = {
    where: { keyHash, revokedAt: null },
    select: {
      id: true,
      label: true,
      readOnly: true,
      createdByUserId: true,
      ownerCredentialVersion: true,
      revokedAt: true,
    },
  } satisfies Prisma.McpApiKeyFindFirstArgs;
  return db.findFirst(args);
};

const defaultFindOwnerUser = async (
  userId: string,
  userDb: UserDb,
): Promise<{
  role: UserRole;
  isActive: boolean;
  credentialVersion: number;
} | null> => {
  const args = {
    where: { id: userId },
    select: { role: true, isActive: true, credentialVersion: true },
  } satisfies Prisma.UserFindUniqueArgs;
  return userDb.findUnique(args);
};

/**
 * Validates a plaintext MCP API key and returns metadata when the key and owner are active.
 *
 * @param plaintext - Raw Bearer token.
 * @param dependencies - Injectable DB and pepper.
 * @returns Key metadata or `null` when invalid, revoked, or owner cannot authenticate.
 */
export const validateApiKey = async (
  plaintext: string,
  {
    db = prisma.mcpApiKey,
    userDb = prisma.user,
    pepper = env.HERMES_MCP_API_KEY_PEPPER,
  }: ValidateMcpApiKeyDependencies = {},
): Promise<ValidatedMcpApiKey | null> => {
  const keyHash = hashMcpApiKey(plaintext, { pepper });
  const row = await defaultFindActiveKeyByHash(keyHash, db);
  if (!row || row.revokedAt) {
    return null;
  }

  const owner = await defaultFindOwnerUser(row.createdByUserId, userDb);
  if (
    !owner ||
    owner.role !== UserRole.ADMIN ||
    !owner.isActive ||
    owner.credentialVersion !== row.ownerCredentialVersion
  ) {
    return null;
  }

  return {
    id: row.id,
    label: row.label,
    readOnly: row.readOnly,
    createdByUserId: row.createdByUserId,
  };
};

/**
 * Creates an MCP API key for the given admin user; returns plaintext once.
 *
 * @param input - Label, read-only flag, and creating user id.
 * @param dependencies - Injectable DB, user lookup, and pepper.
 * @returns Created row metadata and one-time plaintext key.
 */
export const createApiKey = async (
  input: CreateMcpApiKeyInput,
  {
    db = prisma.mcpApiKey,
    userDb = prisma.user,
    pepper = env.HERMES_MCP_API_KEY_PEPPER,
  }: CreateMcpApiKeyDependencies = {},
): Promise<CreateMcpApiKeyResult> => {
  const owner = await defaultFindOwnerUser(input.createdByUserId, userDb);
  if (!owner || owner.role !== UserRole.ADMIN || !owner.isActive) {
    throw new Error(
      "MCP API keys can only be created by an active Hermes admin",
    );
  }

  const { apiKeyPlaintext } = generateMcpApiKeyPlaintext();
  const keyHash = hashMcpApiKey(apiKeyPlaintext, { pepper });

  const createArgs = {
    data: {
      label: input.label.trim(),
      keyHash,
      readOnly: input.readOnly,
      createdByUserId: input.createdByUserId,
      ownerCredentialVersion: owner.credentialVersion,
    },
    select: {
      id: true,
      label: true,
      readOnly: true,
      createdByUserId: true,
    },
  } satisfies Prisma.McpApiKeyCreateArgs;

  const row = await db.create(createArgs);

  return {
    id: row.id,
    label: row.label,
    readOnly: row.readOnly,
    createdByUserId: row.createdByUserId,
    apiKeyPlaintext,
  };
};

/**
 * Revokes an MCP API key if it is not already revoked.
 *
 * @param apiKeyId - Key row id.
 * @param revokedByUserId - Admin performing the revoke.
 * @param dependencies - Injectable DB.
 * @returns Whether a row was updated.
 */
export const revokeApiKey = async (
  apiKeyId: string,
  revokedByUserId: string,
  { db = prisma.mcpApiKey }: RevokeMcpApiKeyDependencies = {},
): Promise<boolean> => {
  const updateArgs = {
    where: { id: apiKeyId, revokedAt: null },
    data: {
      revokedAt: new Date(),
      revokedByUserId,
    },
  } satisfies Prisma.McpApiKeyUpdateManyArgs;
  const result = await db.updateMany(updateArgs);
  return result.count > 0;
};

/**
 * Updates `lastUsedAt` for a validated key (fire-and-forget safe for request path).
 *
 * @param apiKeyId - Key row id.
 * @param dependencies - Injectable DB.
 */
export const touchMcpApiKeyLastUsed = async (
  apiKeyId: string,
  { db = prisma.mcpApiKey }: TouchMcpApiKeyLastUsedDependencies = {},
): Promise<void> => {
  const updateArgs = {
    where: { id: apiKeyId },
    data: { lastUsedAt: new Date() },
  } satisfies Prisma.McpApiKeyUpdateArgs;
  await db.update(updateArgs);
};

export type McpApiKeyListRow = {
  id: string;
  label: string;
  readOnly: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
  createdBy: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdByUserId: string;
};

type ListActiveMcpApiKeysDependencies = {
  db?: Pick<typeof prisma.mcpApiKey, "findMany">;
};

/**
 * Lists non-revoked MCP API keys for the dashboard table (no secrets).
 *
 * @param dependencies - Injectable Prisma delegate.
 * @returns Rows ordered by newest first.
 */
export const listActiveMcpApiKeys = async ({
  db = prisma.mcpApiKey,
}: ListActiveMcpApiKeysDependencies = {}): Promise<McpApiKeyListRow[]> => {
  const args = {
    where: { revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      readOnly: true,
      createdAt: true,
      lastUsedAt: true,
      createdByUserId: true,
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  } satisfies Prisma.McpApiKeyFindManyArgs;
  return db.findMany(args);
};
