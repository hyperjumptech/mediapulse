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
    expect(assigned.block.hideHeader).toBe(true);
    expect(assigned.block.columns).toHaveLength(1);

    const scoreColumn = assigned.block.columns[0];
    expect(scoreColumn?.type).toBe("list");
    expect(scoreColumn?.field).toBe("sectionScores");
    expect(scoreColumn?.headingField).toBe("title");
    expect(scoreColumn?.linkTemplate).toBe("{url}");
    expect(scoreColumn?.linkExternal).toBe(true);
    expect(scoreColumn?.truncate).toBeUndefined();
    expect(scoreColumn?.listItem).toEqual({
      field: "scoreLine",
      colorField: "scoreVariant",
      emphasisField: "isSelected",
      descriptionField: "reason",
      collapsible: true,
    });

    expect(rejected?.countField).toBe("sourceAnalysis.rejected");
    expect(rejected?.block.type).toBe("subTable");
    if (rejected?.block.type !== "subTable") return;
    expect(rejected.block.field).toBe("sourceAnalysis.rejected");
    expect(rejected.block.hideHeader).toBe(true);
    expect(rejected.block.columns).toHaveLength(1);

    const rejectedColumn = rejected.block.columns[0];
    expect(rejectedColumn?.type).toBe("text");
    expect(rejectedColumn?.field).toBe("reason");
    expect(rejectedColumn?.headingField).toBe("title");
    expect(rejectedColumn?.linkTemplate).toBe("{url}");
    expect(rejectedColumn?.linkExternal).toBe(true);
    expect(rejectedColumn?.truncate).toBeUndefined();
    expect(rejectedColumn?.listItem).toBeUndefined();
  });
});

describe("newslettersDashboardPage content-generation stage", () => {
  it("groups the stage KPI cards and a per-section results table in one panel", () => {
    const panel = findBlock("Content Generation Stage");
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
      "contentGeneration.agentLabel",
      "contentGeneration.generatedAtLabel",
      "contentGeneration.model",
      "contentGeneration.tokensTotalLabel",
    ]);

    const results = panel.blocks.find(
      (block) =>
        block.type === "subTable" && block.field === "contentGeneration.rows",
    );
    expect(results?.type).toBe("subTable");
    if (results?.type !== "subTable") return;
    expect(results.label).toBe("Results");
    expect(results.hideHeader).toBe(true);
    expect(results.sectionHeaderField).toBe("isSection");
    expect(results.columns).toHaveLength(1);
    expect(results.columns[0]?.field).toBe("label");
    expect(results.columns[0]?.bulletField).toBe("isPoint");
    expect(results.columns[0]?.linkTemplate).toBe("{url}");
    expect(results.columns[0]?.linkExternal).toBe(true);
  });
});

describe("newslettersDashboardPage delivery stage", () => {
  it("groups the delivery KPI cards with an Outcome color and delivered count", () => {
    const panel = findBlock("Delivery Stage");
    expect(panel.type).toBe("panel");
    if (panel.type !== "panel") return;

    const statCards = panel.blocks.find((block) => block.type === "statCards");
    expect(statCards?.type).toBe("statCards");
    if (statCards?.type !== "statCards") return;
    expect(statCards.cards.map((card) => card.label)).toEqual([
      "Agent",
      "Delivered Date",
      "Outcome",
      "Delivered",
    ]);
    expect(statCards.cards.map((card) => card.field)).toEqual([
      "delivery.agentLabel",
      "delivery.deliveredAtLabel",
      "delivery.outcomeLabel",
      "delivery.deliveredLabel",
    ]);
    const outcomeCard = statCards.cards.find(
      (card) => card.label === "Outcome",
    );
    expect(outcomeCard?.colorField).toBe("delivery.outcomeVariant");
  });

  it("splits recipients and the email preview into tabs", () => {
    const panel = findBlock("Delivery Stage");
    if (panel.type !== "panel") return;

    const tabs = panel.blocks.find((block) => block.type === "tabs");
    expect(tabs?.type).toBe("tabs");
    if (tabs?.type !== "tabs") return;
    expect(tabs.tabs.map((tab) => tab.label)).toEqual([
      "Recipients",
      "Email Preview",
      "Email Preview",
    ]);

    const [recipients, preview, indonesianPreview] = tabs.tabs;
    expect(recipients?.countField).toBe("recipients");
    expect(recipients?.block.type).toBe("subTable");
    if (recipients?.block.type !== "subTable") return;
    expect(recipients.block.field).toBe("recipients");
    expect(recipients.block.columns.map((column) => column.label)).toEqual([
      "Recipient",
      "Status",
    ]);

    expect(preview?.badge).toEqual({ label: "en", variant: "outline" });
    expect(preview?.visibleWhen).toBeUndefined();
    expect(preview?.block.type).toBe("htmlPreview");
    if (preview?.block.type !== "htmlPreview") return;
    expect(preview.block.field).toBe("emailPreviewHtml");

    expect(indonesianPreview?.badge).toEqual({
      label: "id",
      variant: "outline",
    });
    expect(indonesianPreview?.visibleWhen).toBe(
      "present(emailPreviewHtmlIndonesian)",
    );
    expect(indonesianPreview?.block.type).toBe("htmlPreview");
    if (indonesianPreview?.block.type !== "htmlPreview") return;
    expect(indonesianPreview.block.field).toBe("emailPreviewHtmlIndonesian");
  });
});
