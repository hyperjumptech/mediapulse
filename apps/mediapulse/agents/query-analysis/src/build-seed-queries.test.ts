/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { buildSeedQueries } from "./build-seed-queries";

const baseContext = {
  ticker: { symbol: "ABC", name: "ABC Ltd" },
};

describe("buildSeedQueries", () => {
  it("emits the symbol and company-name anchors first", () => {
    const rows = buildSeedQueries(baseContext, { language: "en" });

    expect(rows[0]).toEqual({
      text: "ABC",
      intent: "breaking",
      language: "en",
    });
    expect(rows[1]).toEqual({
      text: "ABC Ltd",
      intent: "breaking",
      language: "en",
    });
  });

  it("emits one candidate per newsletter-section intent", () => {
    const rows = buildSeedQueries(baseContext, { language: "en" });
    const intents = new Set(rows.map((row) => row.intent));

    expect(intents.has("competitor")).toBe(true);
    expect(intents.has("regulatory")).toBe(true);
    expect(intents.has("technology_trend")).toBe(true);
    expect(intents.has("industry_trend")).toBe(true);
    expect(intents.has("deals")).toBe(true);
  });

  it("tags every row with the requested language", () => {
    const rows = buildSeedQueries(baseContext, { language: "id" });

    expect(rows.every((row) => row.language === "id")).toBe(true);
  });

  it("does not assign a templateId to any row", () => {
    const rows = buildSeedQueries(baseContext, { language: "en" });

    expect(rows.every((row) => !("templateId" in row))).toBe(true);
  });

  it("resolves localized display names when an alias exists", () => {
    const rows = buildSeedQueries(
      { ticker: { symbol: "BBCA", name: "PT Bank Central Asia Tbk" } },
      { language: "id" },
    );

    expect(rows[1]?.text).toBe("Bank Central Asia");
  });
});
