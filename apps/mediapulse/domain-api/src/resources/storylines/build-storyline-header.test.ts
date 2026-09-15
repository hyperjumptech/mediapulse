/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  buildStorylineHeader,
  type BuildStorylineHeaderInput,
} from "./build-storyline-header";

const input: BuildStorylineHeaderInput = {
  kind: "story",
  locked: false,
  firstObservedAt: new Date("2026-03-02T00:00:00.000Z"),
  lastObservedAt: new Date("2026-04-18T00:00:00.000Z"),
  developmentCount: 12,
  citationCount: 31,
  tickerSymbols: ["FORE", "BBCA"],
};

describe("buildStorylineHeader", () => {
  it("renders every stat card value as a string", () => {
    const header = buildStorylineHeader(input);

    expect(header.kindLabel).toBe("Story");
    expect(header.developmentsLabel).toBe("12");
    expect(header.citationsLabel).toBe("31");
    expect(header.lockedLabel).toBe("Open");
    expect(header.lockedVariant).toBe("success");
  });

  it("renders the observation window and ticker list", () => {
    const header = buildStorylineHeader(input);

    expect(header.windowLabel).toBe("2026-03-02 – 2026-04-18");
    expect(header.tickersLabel).toBe("FORE, BBCA");
  });

  it("marks a locked storyline with the warning variant", () => {
    const header = buildStorylineHeader({ ...input, locked: true });

    expect(header.lockedLabel).toBe("Locked");
    expect(header.lockedVariant).toBe("warning");
  });

  it("renders an em dash when no ticker is linked", () => {
    expect(
      buildStorylineHeader({ ...input, tickerSymbols: [] }).tickersLabel,
    ).toBe("—");
  });

  it("renders zero counts rather than blanks", () => {
    const header = buildStorylineHeader({
      ...input,
      developmentCount: 0,
      citationCount: 0,
    });

    expect(header.developmentsLabel).toBe("0");
    expect(header.citationsLabel).toBe("0");
  });
});
