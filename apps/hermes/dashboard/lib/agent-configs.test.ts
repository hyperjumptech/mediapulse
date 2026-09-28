/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import type { PrismaClientWithSchema } from "@hermes/orchestration-database/client";

import { getAgentConfigsPage } from "./agent-configs";

const createMockDb = () => ({
  agentConfig: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  },
});

const asDb = (db: ReturnType<typeof createMockDb>): PrismaClientWithSchema =>
  db as unknown as PrismaClientWithSchema;

describe("getAgentConfigsPage", () => {
  it("searches name, description, and agent id case-insensitively", async () => {
    const db = createMockDb();
    const expectedWhere = {
      OR: [
        { name: { contains: "daily", mode: "insensitive" } },
        { description: { contains: "daily", mode: "insensitive" } },
        { agentId: { contains: "daily", mode: "insensitive" } },
      ],
    };

    await getAgentConfigsPage(
      2,
      10,
      { search: " daily ", sortBy: "createdAt", sortDir: "desc" },
      asDb(db),
    );

    expect(db.agentConfig.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
        skip: 10,
        take: 10,
        orderBy: { createdAt: "desc" },
      }),
    );
    expect(db.agentConfig.count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it("keeps agent filters and skips blank search", async () => {
    const db = createMockDb();

    await getAgentConfigsPage(
      1,
      20,
      { agentId: "summarizer", agentVersion: "1", search: "  " },
      asDb(db),
    );

    expect(db.agentConfig.count).toHaveBeenCalledWith({
      where: { agentId: "summarizer", agentVersion: "1" },
    });
  });
});
