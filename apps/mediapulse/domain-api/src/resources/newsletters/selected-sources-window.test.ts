import { describe, expect, it } from "vitest";

import { buildSelectedSourcesWindow } from "./selected-sources-window";

describe("buildSelectedSourcesWindow", () => {
  it("snaps window start to UTC midnight of the newsletter day", () => {
    const result = buildSelectedSourcesWindow(
      new Date("2026-05-14T13:42:11.123Z"),
    );

    expect(result.windowStartIso).toBe("2026-05-14T00:00:00.000Z");
    expect(result.windowEndIso).toBe("2026-05-15T00:00:00.000Z");
  });

  it("handles dates already at UTC midnight", () => {
    const result = buildSelectedSourcesWindow(
      new Date("2026-01-01T00:00:00.000Z"),
    );

    expect(result.windowStartIso).toBe("2026-01-01T00:00:00.000Z");
    expect(result.windowEndIso).toBe("2026-01-02T00:00:00.000Z");
  });

  it("crosses month boundaries cleanly", () => {
    const result = buildSelectedSourcesWindow(
      new Date("2026-02-28T22:10:00.000Z"),
    );

    expect(result.windowStartIso).toBe("2026-02-28T00:00:00.000Z");
    expect(result.windowEndIso).toBe("2026-03-01T00:00:00.000Z");
  });

  it("does not mutate the input date", () => {
    const input = new Date("2026-05-14T13:42:11.123Z");
    const before = input.toISOString();

    buildSelectedSourcesWindow(input);

    expect(input.toISOString()).toBe(before);
  });
});
