/** @vitest-environment jsdom */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DetailBlockSubTableView } from "./detail-block-sub-table";

describe("DetailBlockSubTableView", () => {
  it("renders rows and a linkColumn", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "citations",
          label: "Citations",
          columns: [
            { field: "title", label: "Title", type: "text" },
            {
              field: "url",
              label: "URL",
              type: "text",
              linkTemplate: "{url}",
              linkExternal: true,
            },
          ],
          captionTemplate: "Citations ({citations.length} unique)",
        }}
        data={{
          citations: [
            { title: "Article", url: "https://example.com/a" },
            { title: "Other", url: "https://example.com/b" },
          ],
        }}
      />,
    );
    expect(screen.getByText("Citations (2 unique)")).toBeInTheDocument();
    expect(screen.getByText("Article")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /example\.com\/a/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders a descriptionField as a muted line beneath the cell value", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "queries",
          label: "Search queries used",
          columns: [
            {
              field: "text",
              label: "Query",
              type: "text",
              descriptionField: "intent",
            },
          ],
        }}
        data={{
          queries: [{ text: "coffee prices outlook", intent: "breaking" }],
        }}
      />,
    );
    expect(screen.getByText("coffee prices outlook")).toBeInTheDocument();
    expect(screen.getByText("breaking")).toBeInTheDocument();
  });

  it("renders an overlineField as a muted line above the cell value", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "citedArticles",
          label: "Articles cited",
          columns: [
            {
              field: "title",
              label: "Title",
              type: "text",
              linkTemplate: "{url}",
              linkExternal: true,
              overlineField: "publishedSection",
            },
          ],
        }}
        data={{
          citedArticles: [
            {
              title: "Auction concludes",
              url: "https://example.com/auction",
              publishedSection: "Regulatory & Policy Watch",
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("Regulatory & Policy Watch")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Auction concludes" }),
    ).toBeInTheDocument();
  });

  it("omits the column header row when hideHeader is set", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "queries",
          label: "Search Queries",
          hideHeader: true,
          columns: [{ field: "text", label: "Query", type: "text" }],
        }}
        data={{ queries: [{ text: "coffee prices outlook" }] }}
      />,
    );
    expect(screen.getByText("coffee prices outlook")).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Query" }),
    ).not.toBeInTheDocument();
  });

  it("renders the empty-state copy when the array is empty", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "rows",
          columns: [{ field: "x", label: "X", type: "text" }],
          emptyState: "No items match.",
        }}
        data={{ rows: [] }}
      />,
    );
    expect(screen.getByText("No items match.")).toBeInTheDocument();
  });

  it("renders a badge column with an inconsistent marker", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "rows",
          columns: [
            {
              field: "status",
              label: "Status",
              type: "badge",
              badgeVariants: { delivered: "success", failed: "destructive" },
              inconsistentField: "inconsistent",
            },
          ],
        }}
        data={{ rows: [{ status: "delivered", inconsistent: true }] }}
      />,
    );
    expect(screen.getByText("delivered")).toBeInTheDocument();
    expect(screen.getByText("!")).toBeInTheDocument();
  });

  it("truncates long values and exposes the full text via title", () => {
    const long = "a".repeat(120);
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "rows",
          columns: [
            { field: "msg", label: "Message", type: "text", truncate: 80 },
          ],
        }}
        data={{ rows: [{ msg: long }] }}
      />,
    );
    const cell = screen.getByTitle(long);
    expect(cell.textContent).toMatch(/^a{80}…$/);
  });

  it("does not paginate when row count is at or below pageSize", () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({
      id: `r-${index}`,
      name: `Row ${index + 1}`,
    }));
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "rows",
          columns: [{ field: "name", label: "Name", type: "text" }],
          pageSize: 5,
        }}
        data={{ rows }}
      />,
    );

    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Previous" })).toBeNull();
    expect(screen.getByText("Row 1")).toBeInTheDocument();
    expect(screen.getByText("Row 5")).toBeInTheDocument();
  });

  it("paginates rows when row count exceeds pageSize and advances on Next", () => {
    // Setup
    const rows = Array.from({ length: 12 }, (_, index) => ({
      id: `r-${index}`,
      name: `Row ${index + 1}`,
    }));
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "rows",
          columns: [{ field: "name", label: "Name", type: "text" }],
          pageSize: 5,
        }}
        data={{ rows }}
      />,
    );

    // Assert — first page
    expect(screen.getByText(/Showing 1–5 of 12/)).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByText("Row 1")).toBeInTheDocument();
    expect(screen.queryByText("Row 6")).toBeNull();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    // Act — advance one page
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    // Assert — second page
    expect(screen.getByText(/Showing 6–10 of 12/)).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(screen.getByText("Row 6")).toBeInTheDocument();
    expect(screen.queryByText("Row 1")).toBeNull();
    expect(screen.getByRole("button", { name: "Previous" })).not.toBeDisabled();

    // Act — advance to the last page
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    // Assert — last page disables Next
    expect(screen.getByText(/Showing 11–12 of 12/)).toBeInTheDocument();
    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("evaluates section rule against the full unsliced response when paginating", () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({
      id: `r-${index}`,
      status: index < 20 ? "delivered" : "failed",
    }));
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "rows",
          label: "Recipients",
          sectionRule: {
            when: "rows.length > 10",
            badge: "warning",
            label: "many recipients",
          },
          columns: [
            { field: "id", label: "Recipient", type: "text" },
            { field: "status", label: "Status", type: "text" },
          ],
          pageSize: 10,
        }}
        data={{ rows }}
      />,
    );

    expect(screen.getByText("many recipients")).toBeInTheDocument();
    expect(screen.getByText(/Showing 1–10 of 25/)).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(11);
  });

  it("renders section-header rows spanning all columns when sectionHeaderField is set", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "rows",
          label: "Results",
          hideHeader: true,
          sectionHeaderField: "isSection",
          columns: [
            {
              field: "label",
              label: "Article",
              type: "text",
              linkTemplate: "{url}",
              linkExternal: true,
            },
          ],
        }}
        data={{
          rows: [
            { label: "Industry Pulse", url: null, isSection: true },
            { label: "Alpha", url: "https://example.com/a", isSection: false },
          ],
        }}
      />,
    );

    const header = screen.getByText("Industry Pulse");
    expect(header.closest("td")).toHaveAttribute("colspan", "1");
    expect(header.closest("a")).toBeNull();
    expect(screen.getByRole("link", { name: "Alpha" })).toHaveAttribute(
      "href",
      "https://example.com/a",
    );
  });

  it("renders a titled list with a leading value per entry", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "rows",
          label: "Results",
          hideHeader: true,
          columns: [
            {
              field: "sectionScores",
              label: "Article",
              type: "list",
              headingField: "title",
              linkTemplate: "{url}",
              linkExternal: true,
              listItem: {
                field: "scoreLine",
                colorField: "scoreVariant",
                emphasisField: "isSelected",
                descriptionField: "reason",
                collapsible: true,
              },
            },
          ],
        }}
        data={{
          rows: [
            {
              title: "Alpha",
              url: "https://example.com/a",
              sectionScores: [
                {
                  scoreLine: "0.40 - Competitive Landscape",
                  scoreVariant: "warning",
                  isSelected: true,
                  reason: "2 of 5 rules matched.",
                },
                {
                  scoreLine: "0.29 - Industry Pulse",
                  scoreVariant: "destructive",
                  isSelected: false,
                  reason: "2 of 7 rules matched: ip-macro-move.",
                },
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole("link", { name: "Alpha" })).toHaveAttribute(
      "href",
      "https://example.com/a",
    );
    expect(
      screen.getByText("0.40 - Competitive Landscape"),
    ).toBeInTheDocument();
    expect(screen.getByText("0.29 - Industry Pulse")).toBeInTheDocument();
    expect(screen.getByText("2 of 5 rules matched.")).toBeInTheDocument();
    expect(
      screen.getByText("2 of 7 rules matched: ip-macro-move."),
    ).toBeInTheDocument();
    expect(screen.getByText("0.29 - Industry Pulse")).toHaveClass(
      "text-red-600",
      { exact: false },
    );
    expect(screen.getByText("0.40 - Competitive Landscape")).toHaveClass(
      "text-amber-600",
      { exact: false },
    );
  });

  it("hides each collapsible entry's description behind a disclosure toggle", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "rows",
          label: "Results",
          hideHeader: true,
          columns: [
            {
              field: "sectionScores",
              label: "Score",
              type: "list",
              listItem: {
                field: "scoreLine",
                descriptionField: "reason",
                collapsible: true,
              },
            },
          ],
        }}
        data={{
          rows: [
            {
              sectionScores: [
                {
                  scoreLine: "0.80 - Disruptors / Tech",
                  reason: "4 of 5 rules matched: dt-new-tech.",
                },
              ],
            },
          ],
        }}
      />,
    );

    const summary = screen
      .getByText("0.80 - Disruptors / Tech")
      .closest("summary");
    expect(summary).not.toBeNull();
    const disclosure = summary?.closest("details");
    expect(disclosure).not.toBeNull();
    expect(disclosure).not.toHaveAttribute("open");
    expect(
      screen.getByText("4 of 5 rules matched: dt-new-tech."),
    ).toBeInTheDocument();
  });

  it("bolds only the emphasised entry of a list column", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "rows",
          label: "Results",
          hideHeader: true,
          columns: [
            {
              field: "sectionScores",
              label: "Score",
              type: "list",
              listItem: {
                field: "scoreLine",
                emphasisField: "isSelected",
              },
            },
          ],
        }}
        data={{
          rows: [
            {
              sectionScores: [
                {
                  scoreLine: "0.40 - Competitive Landscape",
                  isSelected: true,
                },
                {
                  scoreLine: "0.29 - Industry Pulse",
                  isSelected: false,
                },
              ],
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByText("0.40 - Competitive Landscape").closest("div"),
    ).toHaveClass("font-bold", { exact: false });
    expect(
      screen.getByText("0.29 - Industry Pulse").closest("div"),
    ).not.toHaveClass("font-bold", { exact: false });
  });

  it("renders an em dash for a list column with no entries", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "rows",
          label: "Results",
          hideHeader: true,
          columns: [
            {
              field: "sectionScores",
              label: "Score",
              type: "list",
              headingField: "title",
              listItem: { field: "scoreLine" },
            },
          ],
        }}
        data={{ rows: [{ title: "Alpha", sectionScores: [] }] }}
      />,
    );

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders descriptionField as a link when descriptionLinkTemplate is set", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "rows",
          label: "Results",
          hideHeader: true,
          columns: [
            {
              field: "label",
              label: "Article",
              type: "text",
              descriptionField: "title",
              descriptionLinkTemplate: "{url}",
              linkExternal: true,
            },
          ],
        }}
        data={{
          rows: [
            {
              label: "The board approved a record payout.",
              title: "Telkom declares dividend",
              url: "https://example.com/d",
              isSection: false,
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByText("The board approved a record payout."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Telkom declares dividend" }),
    ).toHaveAttribute("href", "https://example.com/d");
  });

  it("colors a value from colorField and mutes when muted is set", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "rows",
          label: "Assigned",
          columns: [
            {
              field: "score",
              label: "Score",
              type: "text",
              colorField: "band",
              descriptionField: "reason",
            },
            { field: "note", label: "Note", type: "text", muted: true },
          ],
        }}
        data={{
          rows: [
            {
              score: "0.9",
              band: "success",
              reason: "Direct coverage.",
              note: "supporting text",
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("0.9").className).toContain("text-green-600");
    expect(screen.getByText("supporting text").className).toContain(
      "text-muted-foreground",
    );
  });
});
