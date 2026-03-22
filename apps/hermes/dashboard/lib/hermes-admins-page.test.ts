/** @vitest-environment node */
import { UserRole } from "@hermes/orchestration-database";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadHermesAdminsForPage } from "./hermes-admins-page";

describe("loadHermesAdminsForPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads admins ordered by email with safe fields", async () => {
    const rows = [
      {
        id: "a",
        name: "Alice",
        email: "a@b.com",
        isActive: true,
        createdAt: new Date("2025-01-01"),
      },
    ];
    const findMany = vi.fn().mockResolvedValue(rows);
    const result = await loadHermesAdminsForPage({
      db: { findMany },
    });
    expect(result).toEqual(rows);
    expect(findMany).toHaveBeenCalledWith({
      where: { role: UserRole.ADMIN },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { email: "asc" },
    });
  });
});
