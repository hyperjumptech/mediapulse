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

  it("declares a search-queries rule that uses hoursBetween > 24", () => {
    const queries = findBlock("Search Queries");
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
