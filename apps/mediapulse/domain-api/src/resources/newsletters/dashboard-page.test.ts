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

const findColumn = (blockLabel: string, columnLabel: string) => {
  const block = findBlock(blockLabel);
  if (block.type !== "subTable") {
    throw new Error(`not a subTable: ${blockLabel}`);
  }
  const column = block.columns.find((entry) => entry.label === columnLabel);
  if (!column) throw new Error(`column not found: ${columnLabel}`);
  return column;
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

describe("newslettersDashboardPage articles-cited block", () => {
  it("binds to citedArticles and links the title out to the article URL", () => {
    const block = findBlock("Articles cited");
    expect(block.type).toBe("subTable");
    if (block.type !== "subTable") return;
    expect(block.field).toBe("citedArticles");

    const title = findColumn("Articles cited", "Title");
    expect(title.linkTemplate).toBe("{url}");
    expect(title.linkExternal).toBe(true);
  });

  it("shows the published section as an overline above the title", () => {
    const title = findColumn("Articles cited", "Title");
    expect(title.overlineField).toBe("publishedSection");
  });

  it("renders the Query as plain text without a link", () => {
    const query = findColumn("Articles cited", "Query");
    expect(query.linkTemplate).toBeUndefined();
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
      "Agents",
      "Generated Date",
      "Search Credits",
      "Total Results",
    ]);
    expect(statCards.cards.map((card) => card.field)).toEqual([
      "sourceCollection.agentsLabel",
      "sourceCollection.generatedAtLabel",
      "sourceCollection.creditsTotalLabel",
      "sourceCollection.totalLabel",
    ]);
    const creditsCard = statCards.cards.find(
      (card) => card.label === "Search Credits",
    );
    expect(creditsCard?.tooltipField).toBe(
      "sourceCollection.creditsBreakdownLabel",
    );
  });

  it("binds the results table to three columns: Article, Agent, Query", () => {
    const panel = findBlock("Source Collection Stage");
    if (panel.type !== "panel") return;

    const results = panel.blocks.find(
      (block) =>
        block.type === "subTable" && block.field === "sourceCollection.sources",
    );
    expect(results?.type).toBe("subTable");
    if (results?.type !== "subTable") return;
    expect(results.rowLimitOptions).toEqual([5, 10]);
    expect(results.columns.map((column) => column.label)).toEqual([
      "Article",
      "Agent",
      "Query",
    ]);

    const [article] = results.columns;
    expect(article?.field).toBe("title");
    expect(article?.linkTemplate).toBe("{url}");
    expect(article?.linkExternal).toBe(true);
  });
});
