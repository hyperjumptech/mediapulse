import { describe, expect, it } from "vitest";

import { parseCreatedDateBound } from "./parse-created-date-bound";

describe("parseCreatedDateBound", () => {
  it("returns undefined for empty input", () => {
    expect(parseCreatedDateBound(undefined, "start")).toBeUndefined();
    expect(parseCreatedDateBound("  ", "end")).toBeUndefined();
  });

  it("maps date-only from to start of UTC day", () => {
    expect(parseCreatedDateBound("2026-05-01", "start")).toEqual(
      new Date("2026-05-01T00:00:00.000Z"),
    );
  });

  it("maps date-only to to end of UTC day", () => {
    expect(parseCreatedDateBound("2026-05-01", "end")).toEqual(
      new Date("2026-05-01T23:59:59.999Z"),
    );
  });

  it("passes through full ISO timestamps unchanged", () => {
    const iso = "2026-05-01T12:30:00.000Z";
    expect(parseCreatedDateBound(iso, "start")).toEqual(new Date(iso));
    expect(parseCreatedDateBound(iso, "end")).toEqual(new Date(iso));
  });

  it("returns undefined for invalid values", () => {
    expect(parseCreatedDateBound("not-a-date", "start")).toBeUndefined();
  });
});
