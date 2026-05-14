/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
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
});
