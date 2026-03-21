import {
  dashboardManifestSchema,
  type DashboardManifest,
  type RegisterDomainIntegrationRequest,
  type RegisterDomainIntegrationResponse,
} from "@hermes/domain-contract";
import type { Prisma } from "@hermes/orchestration-database";
import { prisma } from "@hermes/orchestration-database";

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

/**
 * Registers (or refreshes) a domain integration record in orchestration storage.
 *
 * @param payload - Integration registration payload.
 * @returns Stored integration record.
 */
export const registerDomainIntegration = async (
  payload: RegisterDomainIntegrationRequest,
): Promise<RegisterDomainIntegrationResponse> => {
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
      lastSeenAt: new Date(),
    },
    update: {
      name: payload.name,
      baseUrl: payload.baseUrl,
      version: payload.version,
      capabilities,
      dashboardManifest,
      isActive: true,
      lastSeenAt: new Date(),
      ...(payload.key === "mediapulse" ? { isDefault: true } : {}),
    },
  });

  return {
    id: integration.id,
    key: integration.key,
    name: integration.name,
    baseUrl: integration.baseUrl,
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
}> => {
  const integration = await prisma.domainIntegration.findFirst({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      key: true,
      name: true,
      baseUrl: true,
      version: true,
      dashboardManifest: true,
    },
  });

  if (!integration) {
    throw new Error("No active domain integration registered");
  }

  return {
    id: integration.id,
    key: integration.key,
    name: integration.name,
    baseUrl: integration.baseUrl,
    version: integration.version,
    dashboard: parseDashboardManifest(integration.dashboardManifest),
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
  baseUrl: string;
  version: string | null;
  dashboardManifest: Prisma.JsonValue | null;
}): DomainIntegrationRecord => ({
  id: row.id,
  key: row.key,
  name: row.name,
  baseUrl: row.baseUrl,
  version: row.version,
  dashboard: parseDashboardManifest(row.dashboardManifest),
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
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { key: "asc" }],
    select: {
      id: true,
      key: true,
      name: true,
      baseUrl: true,
      version: true,
      dashboardManifest: true,
    },
  });
  return rows.map(toDomainIntegrationRecord);
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
    where: { key: integrationKey, isActive: true },
    select: {
      id: true,
      key: true,
      name: true,
      baseUrl: true,
      version: true,
      dashboardManifest: true,
    },
  });
  if (!row) return null;
  return toDomainIntegrationRecord(row);
};
