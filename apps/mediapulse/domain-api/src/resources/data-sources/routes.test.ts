/**
 * Route wiring for data-sources: `GET /meta` must not be captured by `GET /:id`.
 */

/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mediapulse/database")>();
  return {
    ...actual,
    prisma: {
      ...actual.prisma,
      dataSource: {
        ...actual.prisma.dataSource,
        deleteMany: vi.fn(),
      },
    },
  };
});

import { prisma } from "@mediapulse/database";

import { dataSourcesResetAllConfirmToken } from "./custom-actions";
import { dataSourcesRoutes } from "./routes";

describe("dataSourcesRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serves GET /meta with table-v1 meta JSON (not 404 from id lookup)", async () => {
    const res = await dataSourcesRoutes.request("http://localhost/meta", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { title?: string };
    expect(body.title).toBe("Data Sources");
  });

  it("reset-all deletes every data source when confirm token matches", async () => {
    vi.mocked(prisma.dataSource.deleteMany).mockResolvedValue({ count: 2 });

    const res = await dataSourcesRoutes.request("http://localhost/reset-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: dataSourcesResetAllConfirmToken }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: 2 });
    expect(prisma.dataSource.deleteMany).toHaveBeenCalledWith({});
  });
});
