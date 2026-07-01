import { describe, expect, it } from "vitest";

import { buildSelectedSourcesWindow } from "./selected-sources-window";

describe("buildSelectedSourcesWindow", () => {
  it("spans a 24h rolling lookback ending at the newsletter createdAt", () => {
    const result = buildSelectedSourcesWindow(
      new Date("2026-05-14T13:42:11.123Z"),
    );

    expect(result.windowStartIso).toBe("2026-05-13T13:42:11.123Z");
    expect(result.windowEndIso).toBe("2026-05-14T13:42:11.123Z");
  });

  it("crosses day boundaries when subtracting the lookback", () => {
    const result = buildSelectedSourcesWindow(
      new Date("2026-01-01T00:00:00.000Z"),
    );

    expect(result.windowStartIso).toBe("2025-12-31T00:00:00.000Z");
    expect(result.windowEndIso).toBe("2026-01-01T00:00:00.000Z");
  });

  it("crosses month boundaries cleanly", () => {
    const result = buildSelectedSourcesWindow(
      new Date("2026-03-01T05:10:00.000Z"),
    );

    expect(result.windowStartIso).toBe("2026-02-28T05:10:00.000Z");
    expect(result.windowEndIso).toBe("2026-03-01T05:10:00.000Z");
  });

  it("does not mutate the input date", () => {
    const input = new Date("2026-05-14T13:42:11.123Z");
    const before = input.toISOString();

    buildSelectedSourcesWindow(input);

    expect(input.toISOString()).toBe(before);
  });
});
