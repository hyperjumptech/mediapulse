/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import {
  loadExpansionPickerPage,
  loadVariablePickerPage,
} from "./variable-expansion-picker-actions";

describe("loadVariablePickerPage", () => {
  it("returns empty when there is no session", async () => {
    const getSession = vi.fn().mockResolvedValue(null);

    const result = await loadVariablePickerPage(
      { page: 1, pageSize: 20, search: "" },
      { getSession },
    );

    expect(result).toEqual({ items: [], total: 0 });
  });

  it("returns mapped variables when session exists", async () => {
    const getSession = vi.fn().mockResolvedValue({
      id: "u1",
      name: "Test",
      email: "t@test.com",
    });
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
      { getSession, getVariables: getVariables as never, db: {} as never },
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
    const getSession = vi.fn().mockResolvedValue({
      id: "u1",
      name: "Test",
      email: "t@test.com",
    });
    const getVariables = vi.fn();

    const result = await loadVariablePickerPage(
      { page: 0, pageSize: 20 },
      { getSession, getVariables: getVariables as never, db: {} as never },
    );

    expect(getVariables).not.toHaveBeenCalled();
    expect(result).toEqual({ items: [], total: 0 });
  });
});

describe("loadExpansionPickerPage", () => {
  it("returns empty when there is no session", async () => {
    const getSession = vi.fn().mockResolvedValue(null);

    const result = await loadExpansionPickerPage(
      { page: 1, pageSize: 20, search: "" },
      { getSession },
    );

    expect(result).toEqual({ items: [], total: 0 });
  });

  it("returns mapped expansions when session and domain succeed", async () => {
    const getSession = vi.fn().mockResolvedValue({
      id: "u1",
      name: "Test",
      email: "t@test.com",
    });
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
      { getSession, getIntegration, getExpansionsPage },
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
    const getSession = vi.fn().mockResolvedValue({
      id: "u1",
      name: "Test",
      email: "t@test.com",
    });
    const getIntegration = vi.fn().mockRejectedValue(new Error("down"));

    const result = await loadExpansionPickerPage(
      { page: 1, pageSize: 20 },
      { getSession, getIntegration },
    );

    expect(result).toEqual({ items: [], total: 0 });
  });
});
