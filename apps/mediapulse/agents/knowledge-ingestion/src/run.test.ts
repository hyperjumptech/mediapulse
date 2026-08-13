/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { run, STORE_NOT_WIRED } from "./run.js";

vi.mock("@workspace/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

describe("run", () => {
  it("fails loudly rather than reporting an empty corpus", async () => {
    const result = await run({
      input: {},
      config: {},
    } as Parameters<typeof run>[0]);

    expect(result.success).toBe(false);
    expect(result.message).toBe(STORE_NOT_WIRED);
  });

  it("reports zero counters so a run chronicle is never misread as work done", async () => {
    const result = await run({
      input: { limit: 100 },
      config: { dryRun: true },
    } as Parameters<typeof run>[0]);

    expect(result.details).toMatchObject({
      considered: 0,
      storylinesOpened: 0,
      developmentsOpened: 0,
    });
  });
});
