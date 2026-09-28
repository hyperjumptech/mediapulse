/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

const getDashboardAdminMock = vi.fn();
const findUniqueMock = vi.fn();
const createPendingDomainIntegrationMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  getDashboardAdmin: () => getDashboardAdminMock(),
}));

vi.mock("@hermes/orchestration-database", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
    },
  },
}));

vi.mock("@/lib/domain-integrations", () => ({
  createPendingDomainIntegration: (...args: unknown[]) =>
    createPendingDomainIntegrationMock(...args),
}));

import { createDomainIntegrationAction } from "./actions";

const buildFormData = () => {
  const formData = new FormData();
  formData.set("integrationId", "acme");
  formData.set("name", "Acme");

  return formData;
};

describe("createDomainIntegrationAction", () => {
  afterEach(() => {
    getDashboardAdminMock.mockReset();
    findUniqueMock.mockReset();
    createPendingDomainIntegrationMock.mockReset();
  });

  it("returns the unauthorized state when the caller is not an active admin", async () => {
    // Setup
    getDashboardAdminMock.mockResolvedValue(null);

    // Act
    const result = await createDomainIntegrationAction(null, buildFormData());

    // Assert
    expect(result).toEqual({ ok: false, error: "Unauthorized" });
    expect(createPendingDomainIntegrationMock).not.toHaveBeenCalled();
  });

  it("creates the integration for an active admin", async () => {
    // Setup
    getDashboardAdminMock.mockResolvedValue({
      id: "u1",
      name: "U",
      email: "u@example.com",
      credentialVersion: 0,
    });
    findUniqueMock.mockResolvedValue({ id: "u1" });
    createPendingDomainIntegrationMock.mockResolvedValue({
      apiKeyPlaintext: "secret",
      integrationId: "acme",
      name: "Acme",
    });

    // Act
    const result = await createDomainIntegrationAction(null, buildFormData());

    // Assert
    expect(createPendingDomainIntegrationMock).toHaveBeenCalledWith({
      integrationId: "acme",
      name: "Acme",
      userId: "u1",
    });
    expect(result).toEqual({
      ok: true,
      apiKeyPlaintext: "secret",
      integrationId: "acme",
      name: "Acme",
    });
  });
});
