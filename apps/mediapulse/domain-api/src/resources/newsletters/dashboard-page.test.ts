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

const findBlock = (label: string): DetailBlock => {
  const block = newslettersDashboardPage.detailBlocks?.find(
    (entry) => entry.label === label,
  );
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

  it("declares a selected-sources rule that fires when the array is empty", () => {
    const sources = findBlock("Selected sources");
    expect(sources.sectionRule).toMatchObject({
      badge: "muted",
      label: "no sources",
    });

    const ast = parseDetailBlockRule(sources.sectionRule!.when);
    expect(evaluateDetailBlockRule(ast, { selectedSources: [] })).toBe(true);
    expect(evaluateDetailBlockRule(ast, { selectedSources: [{}] })).toBe(false);
  });

  it("selected-sources block has a badge Collected by column with correct variants", () => {
    const sources = findBlock("Selected sources");
    expect(sources.type).toBe("subTable");
    if (sources.type !== "subTable") return;

    const column = sources.columns.find((col) => col.label === "Collected by");
    expect(column).toBeDefined();
    expect(column?.type).toBe("badge");
    expect(column?.field).toBe("collectionSourceLabel");
    expect(column?.badgeVariants).toMatchObject({
      "Page Collection": "success",
      "Data Collection": "outline",
    });
  });

  it("declares a search-queries rule that uses hoursBetween > 24", () => {
    const queries = findBlock("Search queries used");
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
  it("binds to citedArticles and links the title to the data-source detail", () => {
    const block = findBlock("Articles cited");
    expect(block.type).toBe("subTable");
    if (block.type !== "subTable") return;
    expect(block.field).toBe("citedArticles");

    const title = findColumn("Articles cited", "Title");
    expect(title.linkTemplate).toBe(
      "/dashboard/{integrationId}/data-sources/{id}",
    );
  });

  it("marks the Section badge inconsistent on a section re-placement", () => {
    const section = findColumn("Articles cited", "Section");
    expect(section.type).toBe("badge");
    expect(section.inconsistentField).toBe("sectionMismatch");
  });

  it("routes the Query link through queryLinkTickerId so curated rows render plain text", () => {
    const query = findColumn("Articles cited", "Query");
    expect(query.linkTemplate).toBe(
      "/dashboard/{integrationId}/search-queries?tickerId={queryLinkTickerId}",
    );
  });
});
