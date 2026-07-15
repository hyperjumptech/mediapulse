import {
  evaluateDetailBlockRule,
  parseDetailBlockRule,
  type DetailBlock,
} from "@hermes/domain-contract";
import { describe, expect, it } from "vitest";

import {
  NEWSLETTER_STALE_SET_HOURS,
  newslettersDashboardPage,
} from "./dashboard-page";

const allBlocks = (): DetailBlock[] => {
  const blocks: DetailBlock[] = [];
  for (const block of newslettersDashboardPage.detailBlocks ?? []) {
    blocks.push(block);
    if (block.type === "panel") {
      blocks.push(...block.blocks);
    }
  }
  return blocks;
};

const findBlock = (label: string): DetailBlock => {
  const block = allBlocks().find((entry) => entry.label === label);
  if (!block) throw new Error(`block not found: ${label}`);
  return block;
};

describe("newslettersDashboardPage section rules", () => {
  it("declares a recipients rule that fires when delivered < enabled", () => {
    const recipients = findBlock("Recipients");
    expect(recipients.sectionRule).toMatchObject({
      badge: "warning",
      label: "partial delivery",
    });

    const ast = parseDetailBlockRule(recipients.sectionRule!.when);
    expect(
      evaluateDetailBlockRule(ast, {
        recipientsDeliveredCount: 3,
        recipientsEnabledAtSendTime: 5,
      }),
    ).toBe(true);
    expect(
      evaluateDetailBlockRule(ast, {
        recipientsDeliveredCount: 5,
        recipientsEnabledAtSendTime: 5,
      }),
    ).toBe(false);
  });

  it("declares a search-queries rule that uses hoursBetween > 24", () => {
    const queries = findBlock("Results");
    expect(queries.sectionRule).toMatchObject({
      badge: "muted",
      label: "stale set",
    });
    expect(NEWSLETTER_STALE_SET_HOURS).toBe(24);

    const ast = parseDetailBlockRule(queries.sectionRule!.when);
    const newsletterCreatedAt = "2026-05-14T12:00:00.000Z";

    expect(
      evaluateDetailBlockRule(ast, {
        createdAt: newsletterCreatedAt,
        activeQuerySet: { generatedAt: "2026-05-13T11:00:00.000Z" },
      }),
    ).toBe(true);
    expect(
      evaluateDetailBlockRule(ast, {
        createdAt: newsletterCreatedAt,
        activeQuerySet: { generatedAt: "2026-05-14T00:00:00.000Z" },
      }),
    ).toBe(false);
  });
});

describe("newslettersDashboardPage query-generation stage", () => {
  it("groups the stage KPI cards and results table in one panel", () => {
    const panel = findBlock("Query Generation Stage");
    expect(panel.type).toBe("panel");
    if (panel.type !== "panel") return;

    const statCards = panel.blocks.find((block) => block.type === "statCards");
    expect(statCards?.type).toBe("statCards");
    if (statCards?.type !== "statCards") return;
    expect(statCards.cards.map((card) => card.label)).toEqual([
      "Agent",
      "Generated Date",
      "LLM Model",
      "LLM Tokens",
    ]);
    const tokensCard = statCards.cards.find(
      (card) => card.label === "LLM Tokens",
    );
    expect(tokensCard?.tooltipField).toBe(
      "activeQuerySet.tokensBreakdownLabel",
    );

    const results = panel.blocks.find(
      (block) => block.type === "subTable" && block.label === "Results",
    );
    expect(results).toBeDefined();
  });
});

describe("newslettersDashboardPage source-collection stage", () => {
  it("groups the stage KPI cards and results table in one panel", () => {
    const panel = findBlock("Source Collection Stage");
    expect(panel.type).toBe("panel");
    if (panel.type !== "panel") return;

    const statCards = panel.blocks.find((block) => block.type === "statCards");
    expect(statCards?.type).toBe("statCards");
    if (statCards?.type !== "statCards") return;
    expect(statCards.cards.map((card) => card.label)).toEqual([
      "Generated Date",
      "Search Credits",
      "Total Collected",
      "Total Dropped",
    ]);
    expect(statCards.cards.map((card) => card.field)).toEqual([
      "sourceCollection.generatedAtLabel",
      "sourceCollection.creditsTotalLabel",
      "sourceCollection.collectedTotalLabel",
      "sourceCollection.droppedTotalLabel",
    ]);
    const creditsCard = statCards.cards.find(
      (card) => card.label === "Search Credits",
    );
    expect(creditsCard?.tooltipField).toBe(
      "sourceCollection.creditsBreakdownLabel",
    );
  });

  it("splits the results into Collected and Dropped tabs", () => {
    const panel = findBlock("Source Collection Stage");
    if (panel.type !== "panel") return;

    const tabs = panel.blocks.find((block) => block.type === "tabs");
    expect(tabs?.type).toBe("tabs");
    if (tabs?.type !== "tabs") return;
    expect(tabs.tabs.map((tab) => tab.label)).toEqual(["Collected", "Dropped"]);

    const [collected, dropped] = tabs.tabs;
    expect(collected?.block.type).toBe("subTable");
    if (collected?.block.type !== "subTable") return;
    expect(collected.block.field).toBe("sourceCollection.sources");
    expect(collected.block.rowLimitDefaultAll).toBe(true);
    expect(collected.block.columns.map((column) => column.label)).toEqual([
      "Article",
      "Query",
    ]);
    expect(collected.block.columns[0]?.linkExternal).toBe(true);
    expect(collected.block.columns[0]?.descriptionField).toBe("agentLine");

    expect(dropped?.block.type).toBe("subTable");
    if (dropped?.block.type !== "subTable") return;
    expect(dropped.block.field).toBe("sourceCollection.dropped");
    expect(dropped.block.columns.map((column) => column.label)).toEqual([
      "Article URL",
      "Reason",
    ]);
    expect(dropped.block.columns[0]?.noWrap).toBe(true);
    expect(dropped.block.columns[0]?.descriptionField).toBe("agentLine");
    const reasonColumn = dropped.block.columns.find(
      (column) => column.field === "reason",
    );
    expect(reasonColumn?.descriptionField).toBe("reasonDetail");
  });
});

describe("newslettersDashboardPage source-analysis stage", () => {
  it("groups the stage KPI cards and results table in one panel", () => {
    const panel = findBlock("Source Analysis Stage");
    expect(panel.type).toBe("panel");
    if (panel.type !== "panel") return;

    const statCards = panel.blocks.find((block) => block.type === "statCards");
    expect(statCards?.type).toBe("statCards");
    if (statCards?.type !== "statCards") return;
    expect(statCards.cards.map((card) => card.label)).toEqual([
      "Agent",
      "Generated Date",
      "LLM Model",
      "LLM Tokens",
    ]);
    expect(statCards.cards.map((card) => card.field)).toEqual([
      "sourceAnalysis.agentLabel",
      "sourceAnalysis.generatedAtLabel",
      "sourceAnalysis.modelLabel",
      "sourceAnalysis.tokensTotalLabel",
    ]);
    const tokensCard = statCards.cards.find(
      (card) => card.label === "LLM Tokens",
    );
    expect(tokensCard?.tooltipField).toBe(
      "sourceAnalysis.tokensBreakdownLabel",
    );
  });

  it("splits the results into Assigned and Rejected tabs", () => {
    const panel = findBlock("Source Analysis Stage");
    if (panel.type !== "panel") return;

    const tabs = panel.blocks.find((block) => block.type === "tabs");
    expect(tabs?.type).toBe("tabs");
    if (tabs?.type !== "tabs") return;
    expect(tabs.tabs.map((tab) => tab.label)).toEqual(["Assigned", "Rejected"]);

    const [assigned, rejected] = tabs.tabs;
    expect(assigned?.countField).toBe("sourceAnalysis.assigned");
    expect(assigned?.block.type).toBe("subTable");
    if (assigned?.block.type !== "subTable") return;
    expect(assigned.block.field).toBe("sourceAnalysis.assigned");
    expect(assigned.block.rowLimitDefaultAll).toBe(true);
    expect(assigned.block.columns.map((column) => column.label)).toEqual([
      "Article",
      "Score",
      "Reason",
    ]);
    expect(assigned.block.columns[0]?.linkExternal).toBe(true);
    expect(assigned.block.columns[0]?.descriptionField).toBe("classifiedLabel");
    expect(assigned.block.columns[0]?.minWidth).toBe(320);
    const scoreColumn = assigned.block.columns.find(
      (column) => column.label === "Score",
    );
    expect(scoreColumn?.type).toBe("badge");
    expect(scoreColumn?.badgeVariantField).toBe("scoreVariant");

    expect(rejected?.countField).toBe("sourceAnalysis.rejected");
    expect(rejected?.block.type).toBe("subTable");
    if (rejected?.block.type !== "subTable") return;
    expect(rejected.block.field).toBe("sourceAnalysis.rejected");
    expect(rejected.block.columns.map((column) => column.label)).toEqual([
      "Article",
      "Reason",
    ]);
  });
});
