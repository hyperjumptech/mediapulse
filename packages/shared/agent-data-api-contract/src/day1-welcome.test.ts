import { describe, expect, it } from "vitest";

import { agentDataApiPathname } from "./agent-data-api-manifest.js";
import {
  getDay1WelcomeResponseSchema,
  postDay1WelcomeBodySchema,
} from "./day1-welcome.js";

describe("day1 welcome contract", () => {
  it("serves the welcome, the claim and the release under kebab-case paths", () => {
    expect(agentDataApiPathname("v1", "day1Welcome")).toBe(
      "/api/v1/day1-welcome",
    );
    expect(agentDataApiPathname("v1", "day1WelcomeClaim")).toBe(
      "/api/v1/day1-welcome-claim",
    );
    expect(agentDataApiPathname("v2", "day1WelcomeClaimRelease")).toBe(
      "/api/v2/day1-welcome-claim-release",
    );
  });

  it("accepts a welcome with only the required company fields", () => {
    const parsed = getDay1WelcomeResponseSchema.safeParse({
      welcome: {
        dispatchId: "11111111-1111-4111-8111-111111111111",
        tickerId: "ticker-1",
        userTickerId: "22222222-2222-4222-8222-222222222222",
        language: "id",
        sentAt: null,
        recipient: { email: "reader@example.com" },
        tickerSymbol: "TLKM",
        companyName: "Telkom Indonesia",
        overview: null,
        businessOperation: null,
        classification: [],
        competitors: [],
        regulators: [],
        recentStories: [],
      },
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects a record call without a dispatch id", () => {
    const parsed = postDay1WelcomeBodySchema.safeParse({
      resendEmailId: "re_1",
    });

    expect(parsed.success).toBe(false);
  });
});
