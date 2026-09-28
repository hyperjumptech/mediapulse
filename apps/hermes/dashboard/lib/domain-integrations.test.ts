/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPendingDomainIntegration,
  getActiveDomainIntegrations,
  getActiveDomainIntegrationsCached,
  getDomainIntegrationByIntegrationId,
  getDomainIntegrationsPage,
  invalidateDomainIntegrationsCache,
  registerDomainIntegration,
} from "./domain-integrations";

const prismaFindManyMock = vi.hoisted(() => vi.fn());
const prismaFindFirstMock = vi.hoisted(() => vi.fn());
const prismaUpsertMock = vi.hoisted(() => vi.fn());

vi.mock("@hermes/orchestration-database", () => ({
  DomainIntegrationStatus: { active: "active", pending: "pending" },
  prisma: {
    domainIntegration: {
      findMany: (...args: unknown[]) => prismaFindManyMock(...args),
      findFirst: (...args: unknown[]) => prismaFindFirstMock(...args),
      upsert: (...args: unknown[]) => prismaUpsertMock(...args),
    },
  },
}));

const emptyManifest = {
  templateVersion: 1 as const,
  pages: [],
};

describe("getActiveDomainIntegrations", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns mapped records from findMany", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "i1",
        integrationId: "mediapulse",
        name: "Mediapulse",
        baseUrl: "http://localhost:3001",
        version: "1",
        dashboardManifest: emptyManifest,
        capabilities: ["preview-expansion", "expand-step-inputs"],
      },
    ]);

    const result = await getActiveDomainIntegrations({ findMany });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        status: "active",
        baseUrl: { not: null },
      },
      orderBy: [{ isDefault: "desc" }, { integrationId: "asc" }],
      select: {
        id: true,
        integrationId: true,
        name: true,
        baseUrl: true,
        version: true,
        dashboardManifest: true,
        capabilities: true,
        updatedAt: true,
      },
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.integrationId).toBe("mediapulse");
    expect(result[0]?.dashboard.templateVersion).toBe(1);
    expect(result[0]?.capabilities).toContain("preview-expansion");
  });

  it("returns empty array when findMany returns none", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    const result = await getActiveDomainIntegrations({ findMany });

    expect(result).toEqual([]);
  });
});

describe("getDomainIntegrationByIntegrationId", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns record when findFirst finds active integration", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "i1",
      integrationId: "mediapulse",
      name: "Mediapulse",
      baseUrl: "http://localhost:3001",
      version: "1",
      dashboardManifest: emptyManifest,
      capabilities: ["preview-expansion", "expand-step-inputs"],
    });

    const result = await getDomainIntegrationByIntegrationId("mediapulse", {
      findFirst,
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        integrationId: "mediapulse",
        isActive: true,
        status: "active",
        baseUrl: { not: null },
      },
      select: {
        id: true,
        integrationId: true,
        name: true,
        baseUrl: true,
        version: true,
        dashboardManifest: true,
        capabilities: true,
        updatedAt: true,
      },
    });
    expect(result?.integrationId).toBe("mediapulse");
  });

  it("returns null when not found", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);

    const result = await getDomainIntegrationByIntegrationId("missing", {
      findFirst,
    });

    expect(result).toBeNull();
  });
});

describe("getDomainIntegrationsPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns integrations, total, page, and pageSize", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "i1",
        integrationId: "mediapulse",
        name: "Mediapulse",
        status: "active",
        baseUrl: "http://localhost:3001",
        isDefault: true,
        isActive: true,
        createdById: "u1",
        createdBy: null,
      },
    ]);
    const count = vi.fn().mockResolvedValue(1);

    const result = await getDomainIntegrationsPage(1, 10, {
      findMany,
      count,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 }),
    );
    expect(result).toEqual({
      integrations: [
        {
          id: "i1",
          integrationId: "mediapulse",
          name: "Mediapulse",
          status: "active",
          baseUrl: "http://localhost:3001",
          isDefault: true,
          isActive: true,
          createdById: "u1",
          createdBy: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    });
  });
});

const buildActiveRow = (integrationId: string) => ({
  id: `id-${integrationId}`,
  integrationId,
  name: integrationId,
  baseUrl: "http://localhost:3001",
  version: "1",
  dashboardManifest: emptyManifest,
  capabilities: ["preview-expansion"],
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
});

const createDeferred = <Value>() => {
  let resolve: (value: Value) => void = () => undefined;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

describe("getActiveDomainIntegrationsCached", () => {
  beforeEach(() => {
    invalidateDomainIntegrationsCache();
    prismaFindManyMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reuses the loaded list within 60 seconds", async () => {
    // Setup
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-28T00:00:00.000Z"));
    prismaFindManyMock.mockResolvedValue([buildActiveRow("mediapulse")]);

    // Act
    const firstList = await getActiveDomainIntegrationsCached();
    vi.setSystemTime(new Date("2026-09-28T00:00:59.999Z"));
    const secondList = await getActiveDomainIntegrationsCached();

    // Assert
    expect(prismaFindManyMock).toHaveBeenCalledTimes(1);
    expect(secondList).toBe(firstList);
    expect(firstList[0]?.integrationId).toBe("mediapulse");
    expect(firstList[0]?.updatedAt).toEqual(
      new Date("2026-09-01T00:00:00.000Z"),
    );
  });

  it("reloads the list once 60 seconds have passed", async () => {
    // Setup
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-28T00:00:00.000Z"));
    prismaFindManyMock.mockResolvedValue([buildActiveRow("mediapulse")]);

    // Act
    await getActiveDomainIntegrationsCached();
    vi.setSystemTime(new Date("2026-09-28T00:01:00.000Z"));
    await getActiveDomainIntegrationsCached();

    // Assert
    expect(prismaFindManyMock).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight load between concurrent callers", async () => {
    // Setup
    const deferredRows = createDeferred<unknown[]>();
    prismaFindManyMock.mockReturnValue(deferredRows.promise);

    // Act
    const firstRequest = getActiveDomainIntegrationsCached();
    const secondRequest = getActiveDomainIntegrationsCached();
    deferredRows.resolve([buildActiveRow("mediapulse")]);
    const lists = await Promise.all([firstRequest, secondRequest]);

    // Assert
    expect(prismaFindManyMock).toHaveBeenCalledTimes(1);
    expect(lists[0]).toBe(lists[1]);
  });

  it("reloads the list after it is invalidated", async () => {
    // Setup
    prismaFindManyMock
      .mockResolvedValueOnce([buildActiveRow("mediapulse")])
      .mockResolvedValueOnce([
        buildActiveRow("mediapulse"),
        buildActiveRow("acme"),
      ]);

    // Act
    await getActiveDomainIntegrationsCached();
    invalidateDomainIntegrationsCache();
    const reloadedList = await getActiveDomainIntegrationsCached();

    // Assert
    expect(prismaFindManyMock).toHaveBeenCalledTimes(2);
    expect(reloadedList).toHaveLength(2);
  });

  it("does not keep a load that finished after an invalidation", async () => {
    // Setup
    const deferredRows = createDeferred<unknown[]>();
    prismaFindManyMock
      .mockReturnValueOnce(deferredRows.promise)
      .mockResolvedValueOnce([buildActiveRow("acme")]);

    // Act
    const staleRequest = getActiveDomainIntegrationsCached();
    invalidateDomainIntegrationsCache();
    deferredRows.resolve([buildActiveRow("mediapulse")]);
    await staleRequest;
    const freshList = await getActiveDomainIntegrationsCached();

    // Assert
    expect(prismaFindManyMock).toHaveBeenCalledTimes(2);
    expect(freshList[0]?.integrationId).toBe("acme");
  });

  it("does not cache a failed load", async () => {
    // Setup
    prismaFindManyMock
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce([buildActiveRow("mediapulse")]);

    // Act
    const failedError = await getActiveDomainIntegrationsCached().catch(
      (error: unknown) => error,
    );
    const recoveredList = await getActiveDomainIntegrationsCached();

    // Assert
    expect((failedError as Error).message).toBe("db down");
    expect(recoveredList).toHaveLength(1);
    expect(prismaFindManyMock).toHaveBeenCalledTimes(2);
  });
});

describe("getDomainIntegrationByIntegrationId without an injected db", () => {
  beforeEach(() => {
    invalidateDomainIntegrationsCache();
    prismaFindManyMock.mockReset();
    prismaFindFirstMock.mockReset();
  });

  it("resolves the integration from the cached active list", async () => {
    // Setup
    prismaFindManyMock.mockResolvedValue([buildActiveRow("mediapulse")]);

    // Act
    const firstLookup = await getDomainIntegrationByIntegrationId("mediapulse");
    const secondLookup =
      await getDomainIntegrationByIntegrationId("mediapulse");

    // Assert
    expect(firstLookup?.id).toBe("id-mediapulse");
    expect(secondLookup).toBe(firstLookup);
    expect(prismaFindManyMock).toHaveBeenCalledTimes(1);
    expect(prismaFindFirstMock).not.toHaveBeenCalled();
  });

  it("falls back to a direct query when the cached list does not have it", async () => {
    // Setup
    prismaFindManyMock.mockResolvedValue([buildActiveRow("mediapulse")]);
    prismaFindFirstMock.mockResolvedValue(buildActiveRow("acme"));

    // Act
    const lookup = await getDomainIntegrationByIntegrationId("acme");

    // Assert
    expect(lookup?.id).toBe("id-acme");
    expect(prismaFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ integrationId: "acme" }),
      }),
    );
  });

  it("returns null when neither the cache nor the database has it", async () => {
    // Setup
    prismaFindManyMock.mockResolvedValue([]);
    prismaFindFirstMock.mockResolvedValue(null);

    // Act
    const lookup = await getDomainIntegrationByIntegrationId("missing");

    // Assert
    expect(lookup).toBeNull();
  });
});

describe("domain integration writers", () => {
  beforeEach(() => {
    invalidateDomainIntegrationsCache();
    prismaFindManyMock.mockReset();
    prismaFindFirstMock.mockReset();
    prismaUpsertMock.mockReset();
  });

  it("invalidates the integration list when an integration registers", async () => {
    // Setup
    prismaFindManyMock.mockResolvedValue([buildActiveRow("mediapulse")]);
    await getActiveDomainIntegrationsCached();
    prismaFindFirstMock.mockResolvedValue({ id: "id-mediapulse" });
    prismaUpsertMock.mockResolvedValue({
      ...buildActiveRow("mediapulse"),
      isActive: true,
      isDefault: true,
    });

    // Act
    await registerDomainIntegration(
      {
        integrationId: "mediapulse",
        name: "Mediapulse",
        baseUrl: "http://localhost:3001",
        version: "2",
        capabilities: ["preview-expansion"],
        dashboard: { templateVersion: 1, views: [] },
      },
      "raw-api-key",
    );
    await getActiveDomainIntegrationsCached();

    // Assert
    expect(prismaFindManyMock).toHaveBeenCalledTimes(2);
  });

  it("invalidates the integration list when a pending integration is created", async () => {
    // Setup
    prismaFindManyMock.mockResolvedValue([]);
    await getActiveDomainIntegrationsCached();
    const createMock = vi.fn().mockResolvedValue({
      id: "id-acme",
      integrationId: "acme",
      name: "Acme",
    });
    const db = {
      $transaction: async (
        callback: (transaction: unknown) => Promise<unknown>,
      ) => callback({ domainIntegration: { create: createMock } }),
    };

    // Act
    const created = await createPendingDomainIntegration(
      { integrationId: "acme", name: "Acme", userId: "u1" },
      db as never,
      "test-hermes-internal-api-key",
    );
    await getActiveDomainIntegrationsCached();

    // Assert
    expect(created.integrationId).toBe("acme");
    expect(prismaFindManyMock).toHaveBeenCalledTimes(2);
  });
});
