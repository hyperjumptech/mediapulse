import {
  dashboardManifestSchema,
  type DashboardManifest,
  type RegisterDomainIntegrationRequest,
  type RegisterDomainIntegrationResponse,
} from "@hermes/domain-contract";
import {
  DomainIntegrationStatus,
  type Prisma,
  prisma,
} from "@hermes/orchestration-database";
import { encryptDomainIntegrationApiKey } from "@hermes/domain-integration-crypto";
import * as crypto from "node:crypto";

import { env } from "@hermes/env";

const defaultCapabilities = [
  "expand-step-inputs",
  "preview-expansion",
] as const;

const parseCapabilities = (
  raw: Prisma.JsonValue | null,
): RegisterDomainIntegrationResponse["capabilities"] => {
  if (!Array.isArray(raw)) return [...defaultCapabilities];
  const parsed = raw.filter(
    (
      entry,
    ): entry is RegisterDomainIntegrationResponse["capabilities"][number] =>
      entry === "expand-step-inputs" || entry === "preview-expansion",
  );
  return parsed.length > 0 ? parsed : [...defaultCapabilities];
};

/**
 * Parses a persisted dashboard manifest JSON payload.
 *
 * @param raw - Raw JSON value stored in Prisma.
 * @returns Normalized dashboard manifest.
 */
const parseDashboardManifest = (
  raw: Prisma.JsonValue | null,
): DashboardManifest => {
  return dashboardManifestSchema
    .catch({
      templateVersion: 1,
      pages: [],
    })
    .parse(raw);
};

const activeIntegrationWhere = {
  isActive: true,
  status: DomainIntegrationStatus.active,
  baseUrl: { not: null },
} satisfies Prisma.DomainIntegrationWhereInput;

/**
 * Registers (or refreshes) a domain integration record in orchestration storage.
 * The Bearer token must be the plaintext API key whose SHA-256 hex matches `encrypted_payload.credential_sha256_hex` for this integration.
 *
 * @param payload - Integration registration payload.
 * @param bearerToken - Raw API key from `Authorization: Bearer`.
 * @returns Stored integration record.
 */
export const registerDomainIntegration = async (
  payload: RegisterDomainIntegrationRequest,
  bearerToken: string,
): Promise<RegisterDomainIntegrationResponse> => {
  const hash = crypto.createHash("sha256").update(bearerToken).digest("hex");
  const bound = await prisma.domainIntegration.findFirst({
    where: {
      key: payload.key,
      encryptedPayload: { credentialSha256Hex: hash },
    },
    select: { id: true },
  });
  if (!bound) {
    throw new Error(
      "Invalid API key for domain integration registration or key does not match this integration key",
    );
  }

  const capabilities = [...payload.capabilities];
  const dashboard = {
    templateVersion: payload.dashboard.templateVersion,
    pages: payload.dashboard.pages,
  };
  const dashboardManifest = JSON.parse(
    JSON.stringify(dashboard),
  ) as Prisma.InputJsonValue;

  if (payload.key === "mediapulse") {
    await prisma.domainIntegration.updateMany({
      where: { key: { not: payload.key } },
      data: { isDefault: false },
    });
  }

  const integration = await prisma.domainIntegration.upsert({
    where: { key: payload.key },
    create: {
      key: payload.key,
      name: payload.name,
      baseUrl: payload.baseUrl,
      version: payload.version,
      capabilities,
      dashboardManifest,
      isDefault: payload.key === "mediapulse",
      isActive: true,
      status: DomainIntegrationStatus.active,
      lastSeenAt: new Date(),
    },
    update: {
      name: payload.name,
      baseUrl: payload.baseUrl,
      version: payload.version,
      capabilities,
      dashboardManifest,
      isActive: true,
      status: DomainIntegrationStatus.active,
      lastSeenAt: new Date(),
      ...(payload.key === "mediapulse" ? { isDefault: true } : {}),
    },
  });

  return {
    id: integration.id,
    key: integration.key,
    name: integration.name,
    baseUrl: integration.baseUrl ?? "",
    version: integration.version,
    capabilities: parseCapabilities(integration.capabilities),
    isActive: integration.isActive,
    isDefault: integration.isDefault,
    dashboard: parseDashboardManifest(integration.dashboardManifest),
  };
};

/**
 * Resolves the active default domain integration for runtime calls.
 *
 * @returns Active integration or null when none is configured.
 */
export const getDefaultDomainIntegration = async (): Promise<{
  id: string;
  key: string;
  name: string;
  baseUrl: string;
  version: string | null;
  dashboard: DashboardManifest;
  capabilities: RegisterDomainIntegrationResponse["capabilities"];
}> => {
  const integration = await prisma.domainIntegration.findFirst({
    where: activeIntegrationWhere,
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      key: true,
      name: true,
      baseUrl: true,
      version: true,
      dashboardManifest: true,
      capabilities: true,
    },
  });

  if (!integration || !integration.baseUrl) {
    throw new Error("No active domain integration registered");
  }

  return {
    id: integration.id,
    key: integration.key,
    name: integration.name,
    baseUrl: integration.baseUrl,
    version: integration.version,
    dashboard: parseDashboardManifest(integration.dashboardManifest),
    capabilities: parseCapabilities(integration.capabilities),
  };
};

/**
 * Shape returned for domain integration lookups (sidebar, routing, HTTP).
 */
export type DomainIntegrationRecord = {
  id: string;
  key: string;
  name: string;
  baseUrl: string;
  version: string | null;
  dashboard: DashboardManifest;
  capabilities: RegisterDomainIntegrationResponse["capabilities"];
};

/**
 * Maps a Prisma domain integration row to a typed record.
 *
 * @param row - Selected row from orchestration DB.
 * @returns Normalized integration record.
 */
const toDomainIntegrationRecord = (row: {
  id: string;
  key: string;
  name: string;
  baseUrl: string | null;
  version: string | null;
  dashboardManifest: Prisma.JsonValue | null;
  capabilities: Prisma.JsonValue | null;
}): DomainIntegrationRecord => ({
  id: row.id,
  key: row.key,
  name: row.name,
  baseUrl: row.baseUrl ?? "",
  version: row.version,
  dashboard: parseDashboardManifest(row.dashboardManifest),
  capabilities: parseCapabilities(row.capabilities),
});

/**
 * Returns all active domain integrations for dashboard navigation and keyed routes.
 *
 * @param db - Prisma delegate (injectable for tests).
 * @returns Ordered list of active integrations with parsed manifests.
 */
export const getActiveDomainIntegrations = async (
  db: Pick<
    typeof prisma.domainIntegration,
    "findMany"
  > = prisma.domainIntegration,
): Promise<DomainIntegrationRecord[]> => {
  const rows = await db.findMany({
    where: activeIntegrationWhere,
    orderBy: [{ isDefault: "desc" }, { key: "asc" }],
    select: {
      id: true,
      key: true,
      name: true,
      baseUrl: true,
      version: true,
      dashboardManifest: true,
      capabilities: true,
    },
  });
  return rows
    .filter((r) => r.baseUrl != null && r.baseUrl.length > 0)
    .map(toDomainIntegrationRecord);
};

/**
 * Loads a single active domain integration by integration key.
 *
 * @param integrationKey - Stable key from registration (e.g. "mediapulse").
 * @param db - Prisma delegate (injectable for tests).
 * @returns Integration record or null if missing or inactive.
 */
export const getDomainIntegrationByKey = async (
  integrationKey: string,
  db: Pick<
    typeof prisma.domainIntegration,
    "findFirst"
  > = prisma.domainIntegration,
): Promise<DomainIntegrationRecord | null> => {
  const row = await db.findFirst({
    where: {
      key: integrationKey,
      ...activeIntegrationWhere,
    },
    select: {
      id: true,
      key: true,
      name: true,
      baseUrl: true,
      version: true,
      dashboardManifest: true,
      capabilities: true,
    },
  });
  if (!row) return null;
  return toDomainIntegrationRecord(row);
};

export type CreatePendingDomainIntegrationInput = {
  /** Unique integration id (e.g. `mediapulse`). */
  key: string;
  /** Human-readable name. */
  name: string;
  /** Orchestration user id recorded on `domain_integration.created_by_id`. */
  userId: string;
};

export type CreatePendingDomainIntegrationResult = {
  id: string;
  key: string;
  name: string;
  /** Raw API key; show once to the operator. */
  apiKeyPlaintext: string;
};

/**
 * Creates a pending domain integration: generates an API key, stores ciphertext and credential hash on `encrypted_payload`.
 *
 * @param input - Integration key, display name, and owning user id.
 * @param db - Prisma client (injectable for tests).
 * @param masterKey - `HERMES_INTERNAL_API_KEY` for encrypting the API key at rest.
 * @returns Created row id and plaintext secret (once).
 */
export const createPendingDomainIntegration = async (
  input: CreatePendingDomainIntegrationInput,
  db: typeof prisma = prisma,
  masterKey: string = env.HERMES_INTERNAL_API_KEY,
): Promise<CreatePendingDomainIntegrationResult> => {
  const rawKey = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const encrypted = encryptDomainIntegrationApiKey(rawKey, masterKey);

  return db.$transaction(async (tx) => {
    const row = await tx.domainIntegration.create({
      data: {
        key: input.key,
        name: input.name,
        baseUrl: null,
        status: DomainIntegrationStatus.pending,
        isActive: false,
        createdById: input.userId,
        ...(input.key === "mediapulse" ? { isDefault: true } : {}),
        encryptedPayload: {
          create: {
            ciphertext: encrypted,
            credentialSha256Hex: hash,
          },
        },
      },
    });

    return {
      id: row.id,
      key: row.key,
      name: row.name,
      apiKeyPlaintext: rawKey,
    };
  });
};
