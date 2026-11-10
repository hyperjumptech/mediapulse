import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mediapulse/database")>();

  return {
    ...actual,
    prisma: {
      ...actual.prisma,
      ticker: {
        ...actual.prisma.ticker,
        deleteMany: vi.fn(),
      },
    },
  };
});

import { prisma } from "@mediapulse/database";

import {
  tickersResetAllConfirmToken,
  tickersTableV1CustomActions,
} from "./custom-actions";
import { tickersRoutes } from "./routes";

describe("tickersRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(
    tickersTableV1CustomActions.map((action) => ({
      id: action.manifest.id,
      path: action.manifest.path,
    })),
  )(
    "registers POST $path declared on the dashboard manifest",
    async ({ path }) => {
      const response = await tickersRoutes.request(`http://localhost${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    },
  );

  it("reset-all deletes every ticker when confirm token matches", async () => {
    vi.mocked(prisma.ticker.deleteMany).mockResolvedValue({ count: 1 });

    const response = await tickersRoutes.request("http://localhost/reset-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: tickersResetAllConfirmToken }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: 1 });
    expect(prisma.ticker.deleteMany).toHaveBeenCalledWith({});
  });
});
