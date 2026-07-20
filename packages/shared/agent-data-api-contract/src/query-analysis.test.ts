/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  getQueryAnalysisResponseSchema,
  queryAnalysisIntentSchema,
  queryAnalysisPostQuerySchema,
  queryAnalysisTickerSchema,
  QUERY_ANALYSIS_INTENTS,
} from "./query-analysis.js";

describe("queryAnalysisIntentSchema", () => {
  it("accepts every section-aligned intent", () => {
    for (const intent of QUERY_ANALYSIS_INTENTS) {
      const result = queryAnalysisIntentSchema.safeParse(intent);

      expect(result.success, `intent '${intent}' was rejected`).toBe(true);
    }
  });

  it("accepts industryPulse query rows", () => {
    const parsed = queryAnalysisPostQuerySchema.parse({
      text: "industri kopi Indonesia konsolidasi",
      intent: "industryPulse",
      rank: 1,
    });
    expect(parsed.intent).toBe("industryPulse");
  });

  it("accepts regulatoryPolicyWatch query rows", () => {
    const parsed = queryAnalysisPostQuerySchema.parse({
      text: "Indonesian telecom regulatory licensing",
      intent: "regulatoryPolicyWatch",
      rank: 4,
    });
    expect(parsed.intent).toBe("regulatoryPolicyWatch");
  });

  it("rejects unknown intent labels", () => {
    const result = queryAnalysisIntentSchema.safeParse("unknown_intent");
    expect(result.success).toBe(false);
  });

  it("rejects retired intent labels", () => {
    for (const retired of ["breaking", "esg", "wildcard", "competitor"]) {
      const result = queryAnalysisIntentSchema.safeParse(retired);

      expect(result.success, `intent '${retired}' was accepted`).toBe(false);
    }
  });

  it("rejects quickHits, which no query feeds", () => {
    const result = queryAnalysisIntentSchema.safeParse("quickHits");
    expect(result.success).toBe(false);
  });
});

describe("queryAnalysisTickerSchema classification fields", () => {
  it("accepts a ticker with sector/industry classification present", () => {
    const parsed = queryAnalysisTickerSchema.parse({
      id: "11111111-1111-1111-1111-111111111111",
      symbol: "ACME",
      name: "Acme Co",
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
    });
    expect(parsed.sector).toBeUndefined();
  });

  it("surfaces classification on the GET response ticker", () => {
    const parsed = getQueryAnalysisResponseSchema.parse({
      ticker: {
        id: "11111111-1111-1111-1111-111111111111",
        symbol: "ACME",
        name: "Acme Co",
        sector: "Technology",
        industry: "Software",
        subSector: null,
        subIndustry: null,
        businessActivity: null,
      },
    });
    expect(parsed.ticker.industry).toBe("Software");
  });
});
