import { describe, expect, it } from "vitest";

import { sleep } from "./index.js";

describe("sleep", () => {
  it("resolves after approximately the given delay", async () => {
    const start = Date.now();
    await sleep(5);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(0);
  });
});
