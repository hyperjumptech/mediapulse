/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  getQueryAnalysisResponseSchema,
  queryAnalysisIntentSchema,
  queryAnalysisPostQuerySchema,
  queryAnalysisTickerSchema,
} from "./query-analysis.js";

describe("queryAnalysisIntentSchema", () => {
  it("accepts legacy breaking intent rows", () => {
    const parsed = queryAnalysisPostQuerySchema.parse({
      text: "ACME latest news",
      intent: "breaking",
      rank: 1,
    });
    expect(parsed.intent).toBe("breaking");
  });

  it("accepts new esg intent rows", () => {
    const parsed = queryAnalysisPostQuerySchema.parse({
      text: "Acme Co ESG controversies",
      intent: "esg",
      rank: 3,
    });
    expect(parsed.intent).toBe("esg");
  });

  it("accepts industry-focused intent rows", () => {
    const parsed = queryAnalysisPostQuerySchema.parse({
      text: "Indonesian telecom regulatory licensing",
      intent: "regulatory",
      rank: 4,
    });
    expect(parsed.intent).toBe("regulatory");
  });

  it("accepts wildcard intent rows", () => {
    const parsed = queryAnalysisPostQuerySchema.parse({
      text: "Oblique cultural narrative angle",
      intent: "wildcard",
      rank: 10,
    });
    expect(parsed.intent).toBe("wildcard");
  });

  it("rejects unknown intent labels", () => {
    const result = queryAnalysisIntentSchema.safeParse("unknown_intent");
    expect(result.success).toBe(false);
  });
});

describe("queryAnalysisTickerSchema classification fields", () => {
  it("accepts a ticker with sector/industry classification present", () => {
    const parsed = queryAnalysisTickerSchema.parse({
      id: "11111111-1111-1111-1111-111111111111",
      symbol: "ACME",
      name: "Acme Co",
      metadata: null,
      sector: "Technology",
      industry: "Software",
      subSector: "Application Software",
      subIndustry: "SaaS",
      businessActivity: "Enterprise software",
    });
    expect(parsed.sector).toBe("Technology");
    expect(parsed.businessActivity).toBe("Enterprise software");
  });

  it("accepts nulls for every classification field", () => {
    const parsed = queryAnalysisTickerSchema.parse({
      id: "11111111-1111-1111-1111-111111111111",
      symbol: "ACME",
      name: "Acme Co",
      metadata: null,
      sector: null,
      industry: null,
      subSector: null,
      subIndustry: null,
      businessActivity: null,
    });
    expect(parsed.sector).toBeNull();
  });

  it("stays backward compatible when classification fields are omitted", () => {
    const parsed = queryAnalysisTickerSchema.parse({
      id: "11111111-1111-1111-1111-111111111111",
      symbol: "ACME",
      name: "Acme Co",
      metadata: null,
    });
    expect(parsed.sector).toBeUndefined();
  });

  it("surfaces classification on the GET response ticker", () => {
    const parsed = getQueryAnalysisResponseSchema.parse({
      ticker: {
        id: "11111111-1111-1111-1111-111111111111",
        symbol: "ACME",
        name: "Acme Co",
        metadata: null,
        sector: "Technology",
        industry: "Software",
        subSector: null,
        subIndustry: null,
        businessActivity: null,
      },
      topEntities: [],
      recentThemes: [],
    });
    expect(parsed.ticker.industry).toBe("Software");
  });
});
