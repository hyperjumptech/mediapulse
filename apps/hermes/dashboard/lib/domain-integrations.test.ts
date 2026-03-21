/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getActiveDomainIntegrations,
  getDomainIntegrationByKey,
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
        key: "mediapulse",
        name: "Mediapulse",
        baseUrl: "http://localhost:3001",
        version: "1",
        dashboardManifest: emptyManifest,
        capabilities: ["preview-expansion", "expand-step-inputs"],
      },
    ]);

    const result = await getActiveDomainIntegrations({ findMany });

    expect(findMany).toHaveBeenCalledWith({
      where: { isActive: true },
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
    expect(result).toHaveLength(1);
    expect(result[0]?.key).toBe("mediapulse");
    expect(result[0]?.dashboard.templateVersion).toBe(1);
    expect(result[0]?.capabilities).toContain("preview-expansion");
  });

  it("returns empty array when findMany returns none", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    const result = await getActiveDomainIntegrations({ findMany });

    expect(result).toEqual([]);
  });
});

describe("getDomainIntegrationByKey", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns record when findFirst finds active integration", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "i1",
      key: "mediapulse",
      name: "Mediapulse",
      baseUrl: "http://localhost:3001",
      version: "1",
      dashboardManifest: emptyManifest,
      capabilities: ["preview-expansion", "expand-step-inputs"],
    });

    const result = await getDomainIntegrationByKey("mediapulse", {
      findFirst,
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: { key: "mediapulse", isActive: true },
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
    expect(result?.key).toBe("mediapulse");
  });

  it("returns null when not found", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);

    const result = await getDomainIntegrationByKey("missing", { findFirst });

    expect(result).toBeNull();
  });
});
