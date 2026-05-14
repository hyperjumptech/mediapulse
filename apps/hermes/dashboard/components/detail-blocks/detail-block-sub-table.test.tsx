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
});
