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

  it("declares a search-queries rule that uses hoursBetween > 24", () => {
    const queries = findBlock("Search queries");
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
