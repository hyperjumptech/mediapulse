/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getDashboardAdminMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  getDashboardAdmin: () => getDashboardAdminMock(),
}));

import {
  loadExpansionPickerPage,
  loadVariablePickerPage,
} from "./variable-expansion-picker-actions";

const admin = {
  id: "u1",
  name: "Test",
  email: "t@test.com",
  credentialVersion: 0,
};

beforeEach(() => {
  getDashboardAdminMock.mockResolvedValue(admin);
});

afterEach(() => {
  getDashboardAdminMock.mockReset();
});

describe("loadVariablePickerPage", () => {
  it("returns empty when the caller is not an active admin", async () => {
    getDashboardAdminMock.mockResolvedValue(null);
    const getVariables = vi.fn();

    const result = await loadVariablePickerPage(
      { page: 1, pageSize: 20, search: "" },
      { getVariables: getVariables as never, db: {} as never },
    );

    expect(result).toEqual({ items: [], total: 0 });
    expect(getVariables).not.toHaveBeenCalled();
  });

  it("returns mapped variables for an active admin", async () => {
    const getVariables = vi.fn().mockResolvedValue({
      variables: [
        { key: "API_KEY", note: "Production key" },
        { key: "OTHER", note: null },
      ],
      total: 5,
      page: 1,
      pageSize: 20,
    });

    const result = await loadVariablePickerPage(
      { page: 1, pageSize: 20, search: "api" },
      { getVariables: getVariables as never, db: {} as never },
    );

    expect(getVariables).toHaveBeenCalledWith(1, 20, { search: "api" }, {});
    expect(result).toEqual({
      items: [
        { key: "API_KEY", description: "Production key" },
        { key: "OTHER", description: null },
      ],
      total: 5,
    });
  });

  it("returns empty when validation fails", async () => {
    const getVariables = vi.fn();

    const result = await loadVariablePickerPage(
      { page: 0, pageSize: 20 },
      { getVariables: getVariables as never, db: {} as never },
    );

    expect(getVariables).not.toHaveBeenCalled();
    expect(result).toEqual({ items: [], total: 0 });
  });
});

describe("loadExpansionPickerPage", () => {
  it("returns empty when the caller is not an active admin", async () => {
    getDashboardAdminMock.mockResolvedValue(null);
    const getIntegration = vi.fn();

    const result = await loadExpansionPickerPage(
      { page: 1, pageSize: 20, search: "" },
      { getIntegration },
    );

    expect(result).toEqual({ items: [], total: 0 });
    expect(getIntegration).not.toHaveBeenCalled();
  });

  it("returns mapped expansions when the admin check and domain succeed", async () => {
    const getIntegration = vi
      .fn()
      .mockResolvedValue({ integrationId: "mediapulse" });
    const getExpansionsPage = vi.fn().mockResolvedValue({
      expansions: [
        {
          id: "e1",
          name: "T",
          expansionString: "db:x",
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    const result = await loadExpansionPickerPage(
      { page: 1, pageSize: 20, search: "x" },
      { getIntegration, getExpansionsPage },
    );

    expect(getExpansionsPage).toHaveBeenCalledWith("mediapulse", 1, 20, {
      search: "x",
    });
    expect(result.items).toEqual([
      { id: "e1", name: "T", expansionString: "db:x", description: null },
    ]);
    expect(result.total).toBe(1);
  });

  it("returns empty on domain failure", async () => {
    const getIntegration = vi.fn().mockRejectedValue(new Error("down"));

    const result = await loadExpansionPickerPage(
      { page: 1, pageSize: 20 },
      { getIntegration },
    );

    expect(result).toEqual({ items: [], total: 0 });
  });
});
