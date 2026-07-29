import { describe, expect, it, vi } from "vitest";

import {
  buildContentGeneration,
  composeSectionHeaderLabel,
  entryPoints,
} from "./build-content-generation";

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
            points: [
              "The board approved a record payout.",
              "Yield nears 5.8 percent.",
            ],
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
        url: null,
        isSection: true,
        isPoint: false,
      },
      {
        label: "Sector momentum recap.",
        url: null,
        isSection: false,
        isPoint: false,
      },
      {
        label: "Deals & Movements - Rp22T Dividend",
        url: null,
        isSection: true,
        isPoint: false,
      },
      {
        label: "Telkom declares Rp22T dividend",
        url: "https://reuters.com/d",
        isSection: false,
        isPoint: false,
      },
      {
        label: "The board approved a record payout.",
        url: null,
        isSection: false,
        isPoint: true,
      },
      {
        label: "Yield nears 5.8 percent.",
        url: null,
        isSection: false,
        isPoint: true,
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

  it("does not repeat the section name when the agent reused it as the heading", async () => {
    const sectionFindMany = vi.fn().mockResolvedValue([
      {
        sectionKey: "dealsAndMovements",
        heading: "Deals & Movements",
        summary: null,
        items: [],
      },
      {
        sectionKey: "quickHits",
        heading: "  quick   hits  ",
        summary: null,
        items: [],
      },
    ]);

    const result = await buildContentGeneration(newsletter(), {
      newsletterSection: { findMany: sectionFindMany },
    });

    expect(result.rows.map((row) => row.label)).toEqual([
      "Deals & Movements",
      "Quick Hits",
    ]);
  });
});

describe("entryPoints", () => {
  it("lists each stored point in order", () => {
    expect(entryPoints(["One.", "Two."])).toEqual(["One.", "Two."]);
  });

  it("trims surrounding whitespace and drops blank points", () => {
    expect(entryPoints(["  One.  ", "   ", "Two."])).toEqual(["One.", "Two."]);
  });

  it("yields nothing for an entry with no points", () => {
    expect(entryPoints([])).toEqual([]);
  });
});

describe("composeSectionHeaderLabel", () => {
  it("appends a heading that adds information", () => {
    expect(
      composeSectionHeaderLabel(
        "Industry Pulse",
        "Telkom Leads Digital Growth",
      ),
    ).toBe("Industry Pulse - Telkom Leads Digital Growth");
  });

  it("drops a heading that only restates the section name", () => {
    expect(
      composeSectionHeaderLabel("Deals & Movements", "Deals & Movements"),
    ).toBe("Deals & Movements");
  });

  it("ignores case and surrounding or repeated whitespace when comparing", () => {
    expect(composeSectionHeaderLabel("Quick Hits", "  quick   HITS  ")).toBe(
      "Quick Hits",
    );
  });

  it("falls back to the section name for an empty heading", () => {
    expect(composeSectionHeaderLabel("Quick Hits", "   ")).toBe("Quick Hits");
  });
});
