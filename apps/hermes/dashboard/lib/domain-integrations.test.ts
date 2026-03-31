/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getActiveDomainIntegrations,
  getDomainIntegrationByIntegrationId,
} from "./domain-integrations";

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
