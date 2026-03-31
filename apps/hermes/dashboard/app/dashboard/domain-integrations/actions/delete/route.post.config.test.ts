/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDeleteDomainIntegrationHandler } from "./route.post.config";

const mockDashboardUser = {
  id: "user-1",
  name: "A",
  email: "a@b.com",
} as const;

const integrationId = "00000000-0000-4000-8000-000000000001";

const baseData = {
  body: { id: integrationId },
  params: {},
  headers: new Headers(),
  searchParams: {},
  user: mockDashboardUser,
};

describe("createDeleteDomainIntegrationHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes domain integration and returns ok", async () => {
    // Setup
    const deleteMock = vi.fn().mockResolvedValue(undefined);
    const db = {
      pipeline: { count: vi.fn().mockResolvedValue(0) },
      domainIntegration: { delete: deleteMock },
    };
    const handler = createDeleteDomainIntegrationHandler({
      db: db as never,
    });

    // Act
    const result = await handler(baseData as never);

    // Assert
    expect(result.status).toBe(true);
    expect((result as { data?: { ok: boolean } }).data?.ok).toBe(true);
    expect(deleteMock).toHaveBeenCalledWith({
      where: { id: integrationId },
    });
  });

  it("returns error when pipelines still reference the integration", async () => {
    // Setup
    const deleteMock = vi.fn();
    const db = {
      pipeline: { count: vi.fn().mockResolvedValue(1) },
      domainIntegration: { delete: deleteMock },
    };
    const handler = createDeleteDomainIntegrationHandler({
      db: db as never,
    });

    // Act
    const result = await handler(baseData as never);

    // Assert
    expect(result.status).toBe(false);
    expect((result as { message?: string }).message).toContain("pipelines");
    expect(deleteMock).not.toHaveBeenCalled();
  });
});
