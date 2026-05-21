/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  DEFAULT_QUERY_EXEMPLARS,
  formatExemplarAssistantContent,
  selectFewShotExemplars,
} from "./default-exemplars";

describe("selectFewShotExemplars", () => {
  it("returns zero exemplars when count is 0", () => {
    expect(selectFewShotExemplars(0)).toEqual([]);
  });

  it("caps at the library size", () => {
    expect(selectFewShotExemplars(10)).toHaveLength(
      DEFAULT_QUERY_EXEMPLARS.length,
    );
  });
});

describe("formatExemplarAssistantContent", () => {
  it("formats query rows with intents", () => {
    const text = formatExemplarAssistantContent([
      { text: "ACME latest news", intent: "breaking" },
    ]);
    expect(text).toContain("ACME latest news");
    expect(text).toContain("(breaking)");
  });
});
