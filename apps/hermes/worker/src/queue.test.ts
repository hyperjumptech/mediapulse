/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@hermes/env/hermes-worker", () => ({
  env: { PG_DATAQUEUE_DATABASE: undefined },
}));

describe("getJobQueue", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("throws when PG_DATAQUEUE_DATABASE is not set", async () => {
    const { getJobQueue } = await import("./queue");
    expect(() => getJobQueue()).toThrow(
      /PG_DATAQUEUE_DATABASE is required for Hermes scheduler/,
    );
  });
});
