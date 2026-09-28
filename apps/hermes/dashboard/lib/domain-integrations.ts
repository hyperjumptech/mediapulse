import {
  dashboardManifestSchema,
  domainIntegrationCapabilitySchema,
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
import { cache } from "react";

import { env } from "@hermes/env";

const defaultCapabilities = [
  "expand-step-inputs",
  "preview-expansion",
] as const;

const parseCapabilities = (
  raw: Prisma.JsonValue | null,
): RegisterDomainIntegrationResponse["capabilities"] => {
  if (!Array.isArray(raw)) return [...defaultCapabilities];
  const allowed = domainIntegrationCapabilitySchema.options;
  const parsed = raw.filter(
    (
      entry,
    ): entry is RegisterDomainIntegrationResponse["capabilities"][number] =>
      typeof entry === "string" &&
      (allowed as readonly string[]).includes(entry),
  );
  return parsed.length > 0 ? parsed : [...defaultCapabilities];
};

const parseDashboardManifest = (
  raw: Prisma.JsonValue | null,
): DashboardManifest => {
  return dashboardManifestSchema
    .catch({
      templateVersion: 1,
      views: [],
    })
    .parse(raw);
};

const activeIntegrationWhere = {
  isActive: true,
  status: DomainIntegrationStatus.active,
  baseUrl: { not: null },
} satisfies Prisma.DomainIntegrationWhereInput;

export const registerDomainIntegration = async (
  payload: RegisterDomainIntegrationRequest,
  bearerToken: string,
): Promise<RegisterDomainIntegrationResponse> => {
  const hash = crypto.createHash("sha256").update(bearerToken).digest("hex");
  const bound = await prisma.domainIntegration.findFirst({
    where: {
      integrationId: payload.integrationId,
      encryptedPayload: { credentialSha256Hex: hash },
    },
    select: { id: true },
  });
  if (!bound) {
    throw new Error(
      "Invalid API key for domain integration registration or credential does not match this integration id",
    );
  }

  const capabilities = [...payload.capabilities];
  const dashboard = {
    templateVersion: payload.dashboard.templateVersion,
    views: payload.dashboard.views,
  };
  const dashboardManifest = JSON.parse(
    JSON.stringify(dashboard),
  ) as Prisma.InputJsonValue;

  if (payload.isDefault === true) {
    await prisma.domainIntegration.updateMany({
      where: { integrationId: { not: payload.integrationId } },
      data: { isDefault: false },
    });
  }

  const integration = await prisma.domainIntegration.upsert({
    where: { integrationId: payload.integrationId },
    create: {
      integrationId: payload.integrationId,
      name: payload.name,
      baseUrl: payload.baseUrl,
      version: payload.version,
      capabilities,
      dashboardManifest,
      isDefault: payload.isDefault === true,
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
      ...(payload.isDefault === true ? { isDefault: true } : {}),
    },
  });
  invalidateDomainIntegrationsCache();

  return {
    id: integration.id,
    integrationId: integration.integrationId,
    name: integration.name,
    baseUrl: integration.baseUrl ?? "",
    version: integration.version,
    capabilities: parseCapabilities(integration.capabilities),
    isActive: integration.isActive,
    isDefault: integration.isDefault,
    dashboard: parseDashboardManifest(integration.dashboardManifest),
  };
};

export const getDefaultDomainIntegration = async (): Promise<{
  id: string;
  integrationId: string;
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
      integrationId: true,
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
    integrationId: integration.integrationId,
    name: integration.name,
    baseUrl: integration.baseUrl,
    version: integration.version,
    dashboard: parseDashboardManifest(integration.dashboardManifest),
    capabilities: parseCapabilities(integration.capabilities),
  };
};

export type DomainIntegrationRecord = {
  id: string;
  integrationId: string;
  name: string;
  baseUrl: string;
  version: string | null;
  dashboard: DashboardManifest;
  capabilities: RegisterDomainIntegrationResponse["capabilities"];
  updatedAt: Date;
};

const domainIntegrationRecordSelect = {
  id: true,
  integrationId: true,
  name: true,
  baseUrl: true,
  version: true,
  dashboardManifest: true,
  capabilities: true,
  updatedAt: true,
} satisfies Prisma.DomainIntegrationSelect;

const ACTIVE_DOMAIN_INTEGRATIONS_CACHE_TTL_MS = 60_000;

type ActiveDomainIntegrationsCacheState = {
  generation: number;
  loadedAt: number;
  integrations: DomainIntegrationRecord[] | undefined;
  inFlight: Promise<DomainIntegrationRecord[]> | undefined;
};

const activeDomainIntegrationsCacheState: ActiveDomainIntegrationsCacheState = {
  generation: 0,
  loadedAt: 0,
  integrations: undefined,
  inFlight: undefined,
};

const domainIntegrationListSelect = {
  id: true,
  integrationId: true,
  name: true,
  status: true,
  baseUrl: true,
  isDefault: true,
  isActive: true,
  createdById: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.DomainIntegrationSelect;

export type DomainIntegrationListRow = Prisma.DomainIntegrationGetPayload<{
  select: typeof domainIntegrationListSelect;
}>;

export type DomainIntegrationsPageResult = {
  integrations: DomainIntegrationListRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type DomainIntegrationSortField =
  | "isDefault"
  | "integrationId"
  | "name"
  | "status";

export type DomainIntegrationsPageOptions = {
  search?: string;
  sortBy?: DomainIntegrationSortField;
  sortDir?: Prisma.SortOrder;
};

const domainIntegrationSearchWhere = (
  search: string | undefined,
): Prisma.DomainIntegrationWhereInput | undefined => {
  const term = search?.trim();
  if (!term) return undefined;

  return {
    OR: [
      { integrationId: { contains: term, mode: "insensitive" } },
      { name: { contains: term, mode: "insensitive" } },
    ],
  };
};

const domainIntegrationPrimaryOrder = (
  sortBy: DomainIntegrationSortField,
  sortDir: Prisma.SortOrder,
): Prisma.DomainIntegrationOrderByWithRelationInput => {
  if (sortBy === "integrationId") return { integrationId: sortDir };
  if (sortBy === "name") return { name: sortDir };
  if (sortBy === "status") return { status: sortDir };

  return { isDefault: sortDir };
};

const domainIntegrationOrderBy = (
  sortBy: DomainIntegrationSortField,
  sortDir: Prisma.SortOrder,
): Prisma.DomainIntegrationOrderByWithRelationInput[] => {
  const primaryOrder = domainIntegrationPrimaryOrder(sortBy, sortDir);
  if (sortBy === "integrationId") {
    return [primaryOrder];
  }

  return [primaryOrder, { integrationId: "asc" }];
};

export const getDomainIntegrationsPage = async (
  page: number,
  pageSize: number,
  options?: DomainIntegrationsPageOptions,
  db: Pick<
    typeof prisma.domainIntegration,
    "findMany" | "count"
  > = prisma.domainIntegration,
): Promise<DomainIntegrationsPageResult> => {
  const skip = (page - 1) * pageSize;
  const where = domainIntegrationSearchWhere(options?.search);
  const orderBy = domainIntegrationOrderBy(
    options?.sortBy ?? "isDefault",
    options?.sortDir ?? "desc",
  );
  const findManyArgs = {
    where,
    select: domainIntegrationListSelect,
    orderBy,
    skip,
    take: pageSize,
  } satisfies Prisma.DomainIntegrationFindManyArgs;
  const countArgs = { where } satisfies Prisma.DomainIntegrationCountArgs;
  const [integrations, total] = await Promise.all([
    db.findMany(findManyArgs),
    db.count(countArgs),
  ]);

  return { integrations, total, page, pageSize };
};

const toDomainIntegrationRecord = (row: {
  id: string;
  integrationId: string;
  name: string;
  baseUrl: string | null;
  version: string | null;
  dashboardManifest: Prisma.JsonValue | null;
  capabilities: Prisma.JsonValue | null;
  updatedAt: Date;
}): DomainIntegrationRecord => ({
  id: row.id,
  integrationId: row.integrationId,
  name: row.name,
  baseUrl: row.baseUrl ?? "",
  version: row.version,
  dashboard: parseDashboardManifest(row.dashboardManifest),
  capabilities: parseCapabilities(row.capabilities),
  updatedAt: row.updatedAt,
});

export const getActiveDomainIntegrations = async (
  db: Pick<
    typeof prisma.domainIntegration,
    "findMany"
  > = prisma.domainIntegration,
): Promise<DomainIntegrationRecord[]> => {
  const activeIntegrationsQuery = {
    where: activeIntegrationWhere,
    orderBy: [{ isDefault: "desc" }, { integrationId: "asc" }],
    select: domainIntegrationRecordSelect,
  } satisfies Prisma.DomainIntegrationFindManyArgs;
  const rows = await db.findMany(activeIntegrationsQuery);
  return rows
    .filter((r) => r.baseUrl != null && r.baseUrl.length > 0)
    .map(toDomainIntegrationRecord);
};

export const getActiveDomainIntegrationsCached = async (): Promise<
  DomainIntegrationRecord[]
> => {
  const cacheState = activeDomainIntegrationsCacheState;
  const cacheAge = Date.now() - cacheState.loadedAt;
  if (
    cacheState.integrations &&
    cacheAge < ACTIVE_DOMAIN_INTEGRATIONS_CACHE_TTL_MS
  ) {
    return cacheState.integrations;
  }
  if (cacheState.inFlight) {
    return cacheState.inFlight;
  }

  const loadGeneration = cacheState.generation;
  const inFlight = getActiveDomainIntegrations()
    .then((integrations) => {
      if (cacheState.generation === loadGeneration) {
        cacheState.integrations = integrations;
        cacheState.loadedAt = Date.now();
      }

      return integrations;
    })
    .finally(() => {
      if (cacheState.inFlight === inFlight) {
        cacheState.inFlight = undefined;
      }
    });
  cacheState.inFlight = inFlight;

  return inFlight;
};

export const invalidateDomainIntegrationsCache = (): void => {
  activeDomainIntegrationsCacheState.generation += 1;
  activeDomainIntegrationsCacheState.loadedAt = 0;
  activeDomainIntegrationsCacheState.integrations = undefined;
  activeDomainIntegrationsCacheState.inFlight = undefined;
};

const findActiveDomainIntegrationByIntegrationId = async (
  integrationId: string,
  db: Pick<typeof prisma.domainIntegration, "findFirst">,
): Promise<DomainIntegrationRecord | null> => {
  const activeIntegrationQuery = {
    where: {
      integrationId,
      ...activeIntegrationWhere,
    },
    select: domainIntegrationRecordSelect,
  } satisfies Prisma.DomainIntegrationFindFirstArgs;
  const row = await db.findFirst(activeIntegrationQuery);
  if (!row) {
    return null;
  }

  return toDomainIntegrationRecord(row);
};

const getDomainIntegrationByIntegrationIdForRequest = cache(
  async (integrationId: string): Promise<DomainIntegrationRecord | null> => {
    const activeIntegrations = await getActiveDomainIntegrationsCached();
    const cachedIntegration = activeIntegrations.find(
      (integration) => integration.integrationId === integrationId,
    );
    if (cachedIntegration) {
      return cachedIntegration;
    }

    return findActiveDomainIntegrationByIntegrationId(
      integrationId,
      prisma.domainIntegration,
    );
  },
);

export const getDomainIntegrationByIntegrationId = async (
  integrationId: string,
  db?: Pick<typeof prisma.domainIntegration, "findFirst">,
): Promise<DomainIntegrationRecord | null> => {
  if (db) {
    return findActiveDomainIntegrationByIntegrationId(integrationId, db);
  }

  return getDomainIntegrationByIntegrationIdForRequest(integrationId);
};

export type CreatePendingDomainIntegrationInput = {
  integrationId: string;
  name: string;
  userId: string;
  isDefault?: boolean;
};

export type CreatePendingDomainIntegrationResult = {
  id: string;
  integrationId: string;
  name: string;
  apiKeyPlaintext: string;
};

export const createPendingDomainIntegration = async (
  input: CreatePendingDomainIntegrationInput,
  db: typeof prisma = prisma,
  masterKey: string = env.HERMES_INTERNAL_API_KEY,
): Promise<CreatePendingDomainIntegrationResult> => {
  const rawKey = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const encrypted = encryptDomainIntegrationApiKey(rawKey, masterKey);

  const createdIntegration = await db.$transaction(async (tx) => {
    const row = await tx.domainIntegration.create({
      data: {
        integrationId: input.integrationId,
        name: input.name,
        baseUrl: null,
        status: DomainIntegrationStatus.pending,
        isActive: false,
        createdById: input.userId,
        ...(input.isDefault === true ? { isDefault: true } : {}),
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
      integrationId: row.integrationId,
      name: row.name,
      apiKeyPlaintext: rawKey,
    };
  });
  invalidateDomainIntegrationsCache();

  return createdIntegration;
};
