/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

const requireDashboardAdminMock = vi.fn();
const createDomainTableItemMock = vi.fn();
const updateDomainTableItemMock = vi.fn();
const previewDomainExpansionMock = vi.fn();
const revalidatePathMock = vi.fn();
const redirectMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

vi.mock("@/lib/require-dashboard-admin", () => ({
  requireDashboardAdmin: () => requireDashboardAdminMock(),
}));

vi.mock("@/lib/domain-dashboard", () => ({
  createDomainTableItem: (...args: unknown[]) =>
    createDomainTableItemMock(...args),
  updateDomainTableItem: (...args: unknown[]) =>
    updateDomainTableItemMock(...args),
  previewDomainExpansion: (...args: unknown[]) =>
    previewDomainExpansionMock(...args),
}));

import {
  runDomainTablePreviewExpansion,
  submitDomainTableFullPageCreate,
  submitDomainTableFullPageUpdate,
} from "./domain-table-full-page-actions";

const basePath = "/dashboard/mediapulse/tickers";

describe("domain table full-page actions", () => {
  afterEach(() => {
    vi.clearAllMocks();
    requireDashboardAdminMock.mockReset();
  });

  it("creates the item and returns to the list for an active admin", async () => {
    // Setup
    requireDashboardAdminMock.mockResolvedValue({ id: "u1" });

    // Act
    await submitDomainTableFullPageCreate("mediapulse", "tickers", basePath, {
      symbol: "ACME",
    });

    // Assert
    expect(createDomainTableItemMock).toHaveBeenCalledWith(
      "mediapulse",
      "tickers",
      { symbol: "ACME" },
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(basePath);
    expect(redirectMock).toHaveBeenCalledWith(basePath);
  });

  it("updates the item and returns to the list for an active admin", async () => {
    // Setup
    requireDashboardAdminMock.mockResolvedValue({ id: "u1" });

    // Act
    await submitDomainTableFullPageUpdate(
      "mediapulse",
      "tickers",
      "t-1",
      basePath,
      { symbol: "ACME" },
    );

    // Assert
    expect(updateDomainTableItemMock).toHaveBeenCalledWith(
      "mediapulse",
      "tickers",
      "t-1",
      { symbol: "ACME" },
    );
    expect(redirectMock).toHaveBeenCalledWith(basePath);
  });

  it("returns the preview for an active admin", async () => {
    // Setup
    requireDashboardAdminMock.mockResolvedValue({ id: "u1" });
    previewDomainExpansionMock.mockResolvedValue({ items: [] });

    // Act
    const result = await runDomainTablePreviewExpansion("mediapulse", "db:x");

    // Assert
    expect(previewDomainExpansionMock).toHaveBeenCalledWith(
      "mediapulse",
      "db:x",
    );
    expect(result).toEqual({ items: [] });
  });

  const unauthorizedCases = [
    {
      name: "submitDomainTableFullPageCreate",
      invoke: () =>
        submitDomainTableFullPageCreate("mediapulse", "tickers", basePath, {}),
      dependency: createDomainTableItemMock,
    },
    {
      name: "submitDomainTableFullPageUpdate",
      invoke: () =>
        submitDomainTableFullPageUpdate(
          "mediapulse",
          "tickers",
          "t-1",
          basePath,
          {},
        ),
      dependency: updateDomainTableItemMock,
    },
    {
      name: "runDomainTablePreviewExpansion",
      invoke: () => runDomainTablePreviewExpansion("mediapulse", "db:x"),
      dependency: previewDomainExpansionMock,
    },
  ];

  it.each(unauthorizedCases)(
    "$name rejects callers who are not active admins",
    async ({ invoke, dependency }) => {
      // Setup
      requireDashboardAdminMock.mockRejectedValue(new Error("NEXT_REDIRECT"));

      // Act
      const pending = invoke();

      // Assert
      await expect(pending).rejects.toThrow("NEXT_REDIRECT");
      expect(dependency).not.toHaveBeenCalled();
      expect(revalidatePathMock).not.toHaveBeenCalled();
    },
  );
});
