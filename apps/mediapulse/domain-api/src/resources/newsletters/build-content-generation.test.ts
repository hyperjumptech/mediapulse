import { describe, expect, it, vi } from "vitest";

import { buildContentGeneration } from "./build-content-generation";

const newsletter = (
  overrides: Partial<Parameters<typeof buildContentGeneration>[0]> = {},
) => ({
  id: "nl-1",
  createdAt: new Date("2026-07-13T06:00:00.000Z"),
  model: "claude-opus-4-8",
  agentVersion: "3.0.0",
  promptTokens: 4200,
  completionTokens: 1300,
  totalTokens: 5500,
  ...overrides,
});

describe("buildContentGeneration", () => {
  it("builds KPIs and grouped Results rows from the persisted section structure", async () => {
    const sectionFindMany = vi.fn().mockResolvedValue([
      {
        sectionKey: "industryPulse",
        heading: "Telkom Leads Digital Growth",
        summary: "Sector momentum recap.",
        items: [],
      },
      {
        sectionKey: "dealsAndMovements",
        heading: "Rp22T Dividend",
        summary: null,
        items: [
          {
            title: "Telkom declares Rp22T dividend",
            summary: "The board approved a record payout.",
            url: "https://reuters.com/d",
          },
        ],
      },
    ]);

    const result = await buildContentGeneration(newsletter(), {
      newsletterSection: { findMany: sectionFindMany },
    });

    expect(sectionFindMany.mock.calls[0]?.[0]?.where).toEqual({
      newsletterId: "nl-1",
    });
    expect(result.agentLabel).toBe("content-generation - 3.0.0");
    expect(result.generatedAtLabel).toBe("July 13, 2026 at 13:00");
    expect(result.model).toBe("claude-opus-4-8");
    expect(result.tokensTotalLabel).toBe("5.5K");
    expect(result.tokensBreakdownLabel).toBe("Input 4,200 · Output 1,300");

    expect(result.rows).toStrictEqual([
      {
        label: "Industry Pulse - Telkom Leads Digital Growth",
        title: "",
        url: null,
        isSection: true,
      },
      {
        label: "Sector momentum recap.",
        title: "",
        url: null,
        isSection: false,
      },
      {
        label: "Deals & Movements - Rp22T Dividend",
        title: "",
        url: null,
        isSection: true,
      },
      {
        label: "The board approved a record payout.",
        title: "Telkom declares Rp22T dividend",
        url: "https://reuters.com/d",
        isSection: false,
      },
    ]);
  });

  it("derives compact total tokens and empty rows when nothing was persisted", async () => {
    const result = await buildContentGeneration(
      newsletter({ totalTokens: null }),
      { newsletterSection: { findMany: vi.fn().mockResolvedValue([]) } },
    );

    expect(result.tokensTotalLabel).toBe("5.5K");
    expect(result.rows).toStrictEqual([]);
  });
});
