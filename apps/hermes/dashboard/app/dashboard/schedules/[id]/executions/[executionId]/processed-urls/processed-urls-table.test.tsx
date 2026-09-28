import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ProcessedUrlItem } from "@/lib/domain-dashboard";

import { ProcessedUrlsTable } from "./processed-urls-table";

const processedUrl = (
  overrides: Partial<ProcessedUrlItem> = {},
): ProcessedUrlItem => ({
  id: "outcome-1",
  subject: { id: "subject-1", label: "ACME" },
  agent: "collector",
  url: "https://example.com/article",
  status: "dropped",
  reason: "too_old",
  reasonDetail: null,
  source: "https://example.com/feed",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const renderTable = (
  items: ProcessedUrlItem[],
  subjectTitle?: string,
): HTMLElement => {
  render(
    <ProcessedUrlsTable
      tableId="processed-urls-test"
      items={items}
      subjectTitle={subjectTitle}
      urlState={{
        basePath: "/processed-urls",
        page: 1,
        pageSize: 50,
        total: items.length,
        sortDir: "desc",
      }}
      filters={null}
      hasActiveFilters={false}
      clearFiltersHref="/processed-urls"
    />,
  );

  return screen.getByRole("table");
};

const columnValues = (table: HTMLElement, columnIndex: number) =>
  within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[columnIndex]?.textContent);

describe("ProcessedUrlsTable", () => {
  it("heads the subject column with the domain's subject title", () => {
    const table = renderTable([processedUrl()], "Account");

    const headers = within(table)
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(headers[0]).toBe("Account");
    expect(columnValues(table, 0)).toEqual(["ACME"]);
  });

  it("falls back to Subject when the domain sends no subject title", () => {
    const table = renderTable([processedUrl()]);

    const firstHeader = within(table).getAllByRole("columnheader")[0];

    expect(firstHeader).toHaveTextContent("Subject");
  });

  it("shows a dash for rows without a subject", () => {
    const table = renderTable([
      processedUrl({ id: "outcome-1", subject: null }),
      processedUrl({ id: "outcome-2", subject: undefined }),
    ]);

    expect(columnValues(table, 0)).toEqual(["—", "—"]);
  });

  it("shows the reason detail before the reason token", () => {
    const table = renderTable([
      processedUrl({ id: "outcome-1", reasonDetail: "Published in 2019" }),
      processedUrl({ id: "outcome-2" }),
    ]);

    expect(columnValues(table, 3)).toEqual(["Published in 2019", "too_old"]);
  });
});
