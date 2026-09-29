import type { ComponentProps } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DetailBlockSubTableView } from "./detail-block-sub-table";

const table = () => within(screen.getByRole("table"));

const mobileCards = () => {
  const list = document.querySelector<HTMLElement>(
    '[data-slot="data-table-mobile-list"]',
  );
  if (!list) {
    throw new Error("Missing mobile list");
  }

  return list;
};

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} data-next-link="" {...props}>
      {children}
    </a>
  ),
}));

describe("DetailBlockSubTableView", () => {
  it("formats date-time columns instead of printing ISO strings", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "entities",
          columns: [
            { field: "name", label: "Name", type: "text" },
            { field: "lastSeenAt", label: "Last seen", type: "date-time" },
          ],
        }}
        data={{
          entities: [
            { name: "Bank Indonesia", lastSeenAt: "2025-12-31T23:30:00.000Z" },
          ],
        }}
      />,
    );

    expect(table().getByText("Dec 31, 2025, 23:30")).toHaveAttribute(
      "datetime",
      "2025-12-31T23:30:00.000Z",
    );
  });

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
    expect(table().getByText("Article")).toBeInTheDocument();
    const link = table().getByRole("link", { name: /example\.com\/a/i });
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
    expect(table().getByText("coffee prices outlook")).toBeInTheDocument();
    expect(table().getByText("breaking")).toBeInTheDocument();
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
    expect(table().getByText("Regulatory & Policy Watch")).toBeInTheDocument();
    expect(
      table().getByRole("link", { name: "Auction concludes" }),
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
    expect(table().getByText("coffee prices outlook")).toBeInTheDocument();
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
    expect(table().getByText("delivered")).toHaveAttribute(
      "data-tone",
      "success",
    );
    expect(table().getByText("!")).toBeInTheDocument();
  });

  it.each([
    ["destructive", "failed"],
    ["muted", "muted"],
    ["outline", "neutral"],
    ["not-a-variant", "neutral"],
  ])(
    "renders a %s badge variant from a row field with the %s tone",
    (variant, tone) => {
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
                badgeVariantField: "statusVariant",
              },
            ],
          }}
          data={{ rows: [{ status: "sent", statusVariant: variant }] }}
        />,
      );

      expect(table().getByText("sent")).toHaveAttribute("data-tone", tone);
    },
  );

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
    const cell = table().getByTitle(long);
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
    expect(table().getByText("Row 1")).toBeInTheDocument();
    expect(table().getByText("Row 5")).toBeInTheDocument();
  });

  it("paginates rows when row count exceeds pageSize and advances on Next", () => {
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

    expect(screen.getByText(/Showing 1–5 of 12/)).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(table().getByText("Row 1")).toBeInTheDocument();
    expect(table().queryByText("Row 6")).toBeNull();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText(/Showing 6–10 of 12/)).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(table().getByText("Row 6")).toBeInTheDocument();
    expect(table().queryByText("Row 1")).toBeNull();
    expect(screen.getByRole("button", { name: "Previous" })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

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
    expect(table().getAllByRole("row")).toHaveLength(11);
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

    const header = table().getByText("Industry Pulse");
    expect(header.closest("td")).toHaveAttribute("colspan", "1");
    expect(header.closest("a")).toBeNull();
    expect(table().getByRole("link", { name: "Alpha" })).toHaveAttribute(
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

    expect(table().getByRole("link", { name: "Alpha" })).toHaveAttribute(
      "href",
      "https://example.com/a",
    );
    expect(
      table().getByText("0.40 - Competitive Landscape"),
    ).toBeInTheDocument();
    expect(table().getByText("0.29 - Industry Pulse")).toBeInTheDocument();
    expect(table().getByText("2 of 5 rules matched.")).toBeInTheDocument();
    expect(
      table().getByText("2 of 7 rules matched: ip-macro-move."),
    ).toBeInTheDocument();
    expect(table().getByText("0.29 - Industry Pulse")).toHaveClass(
      "text-red-600",
      { exact: false },
    );
    expect(table().getByText("0.40 - Competitive Landscape")).toHaveClass(
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

    const summary = table()
      .getByText("0.80 - Disruptors / Tech")
      .closest("summary");
    expect(summary).not.toBeNull();
    const disclosure = summary?.closest("details");
    expect(disclosure).not.toBeNull();
    expect(disclosure).not.toHaveAttribute("open");
    expect(
      table().getByText("4 of 5 rules matched: dt-new-tech."),
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
      table().getByText("0.40 - Competitive Landscape").closest("div"),
    ).toHaveClass("font-bold", { exact: false });
    expect(
      table().getByText("0.29 - Industry Pulse").closest("div"),
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

    expect(table().getByText("Alpha")).toBeInTheDocument();
    expect(table().getByText("—")).toBeInTheDocument();
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
      table().getByText("The board approved a record payout."),
    ).toBeInTheDocument();
    expect(
      table().getByRole("link", { name: "Telkom declares dividend" }),
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

    expect(table().getByText("0.9").className).toContain("text-green-600");
    expect(table().getByText("supporting text").className).toContain(
      "text-muted-foreground",
    );
  });

  it("renders internal link templates as client-side links", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "rows",
          columns: [
            {
              field: "title",
              label: "Title",
              type: "text",
              linkTemplate: "/dashboard/mediapulse/articles/{id}",
            },
          ],
        }}
        data={{ rows: [{ id: "article-1", title: "Alpha" }] }}
      />,
    );

    const link = table().getByRole("link", { name: "Alpha" });
    expect(link).toHaveAttribute(
      "href",
      "/dashboard/mediapulse/articles/article-1",
    );
    expect(link).toHaveAttribute("data-next-link");
    expect(link).not.toHaveAttribute("target");
  });

  it("keeps external link templates as plain anchors opening in a new tab", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "rows",
          columns: [
            {
              field: "title",
              label: "Title",
              type: "text",
              linkTemplate: "{url}",
              linkExternal: true,
            },
          ],
        }}
        data={{ rows: [{ title: "Alpha", url: "https://example.com/a" }] }}
      />,
    );

    const link = table().getByRole("link", { name: "Alpha" });
    expect(link).toHaveAttribute("href", "https://example.com/a");
    expect(link).not.toHaveAttribute("data-next-link");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("treats protocol-relative link templates as external anchors", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "rows",
          columns: [
            {
              field: "title",
              label: "Title",
              type: "text",
              linkTemplate: "//example.com/{id}",
            },
          ],
        }}
        data={{ rows: [{ id: "a", title: "Alpha" }] }}
      />,
    );

    const link = table().getByRole("link", { name: "Alpha" });
    expect(link).toHaveAttribute("href", "//example.com/a");
    expect(link).not.toHaveAttribute("data-next-link");
  });

  it("renders internal heading and description links as client-side links", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "rows",
          hideHeader: true,
          columns: [
            {
              field: "sectionScores",
              label: "Article",
              type: "list",
              headingField: "title",
              linkTemplate: "/dashboard/mediapulse/articles/{id}",
              listItem: { field: "scoreLine" },
            },
            {
              field: "label",
              label: "Source",
              type: "text",
              descriptionField: "sourceName",
              descriptionLinkTemplate:
                "/dashboard/mediapulse/data-sources/{sourceId}",
            },
          ],
        }}
        data={{
          rows: [
            {
              id: "article-1",
              title: "Alpha",
              sectionScores: [{ scoreLine: "0.40 - Industry Pulse" }],
              label: "Collected",
              sourceName: "Bisnis",
              sourceId: "source-1",
            },
          ],
        }}
      />,
    );

    const headingLink = table().getByRole("link", { name: "Alpha" });
    const descriptionLink = table().getByRole("link", { name: "Bisnis" });
    expect(headingLink).toHaveAttribute(
      "href",
      "/dashboard/mediapulse/articles/article-1",
    );
    expect(headingLink).toHaveAttribute("data-next-link");
    expect(descriptionLink).toHaveAttribute(
      "href",
      "/dashboard/mediapulse/data-sources/source-1",
    );
    expect(descriptionLink).toHaveAttribute("data-next-link");
  });

  it("keeps an internal link opening in a new tab when linkExternal is set", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "rows",
          columns: [
            {
              field: "title",
              label: "Title",
              type: "text",
              linkTemplate: "/dashboard/mediapulse/articles/{id}",
              linkExternal: true,
            },
          ],
        }}
        data={{ rows: [{ id: "article-1", title: "Alpha" }] }}
      />,
    );

    const link = table().getByRole("link", { name: "Alpha" });
    expect(link).toHaveAttribute("data-next-link");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the column labels as a header row by default", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "rows",
          columns: [
            { field: "name", label: "Name", type: "text" },
            { field: "status", label: "Status", type: "text" },
          ],
        }}
        data={{ rows: [{ name: "Alpha", status: "sent" }] }}
      />,
    );

    const headers = table()
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(headers).toEqual(["Name", "Status"]);
  });

  it("stacks each row as a phone card titled by its first column", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "rows",
          hideHeader: true,
          columns: [
            {
              field: "title",
              label: "Article",
              type: "text",
              linkTemplate: "{url}",
              linkExternal: true,
              descriptionField: "agentLine",
            },
            { field: "queryText", label: "Query", type: "text" },
            {
              field: "status",
              label: "Status",
              type: "badge",
              badgeVariants: { collected: "success" },
            },
          ],
        }}
        data={{
          rows: [
            {
              title: "Alpha",
              url: "https://example.com/a",
              agentLine: "data-collection",
              queryText: "coffee prices",
              status: "collected",
            },
          ],
        }}
      />,
    );

    const cards = within(mobileCards()).getAllByRole("listitem");
    const card = within(cards[0] as HTMLElement);

    expect(cards).toHaveLength(1);
    expect(card.getByRole("link", { name: "Alpha" })).toHaveAttribute(
      "href",
      "https://example.com/a",
    );
    expect(card.getByText("data-collection")).toBeInTheDocument();
    expect(card.getByRole("term")).toHaveTextContent("Query");
    expect(card.getByRole("definition")).toHaveTextContent("coffee prices");
    expect(card.getByText("collected")).toHaveAttribute("data-tone", "success");
  });

  it("wraps phone card values instead of cutting them off", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "rows",
          columns: [
            { field: "title", label: "Article", type: "text" },
            { field: "reason", label: "Reason", type: "text" },
            { field: "kind", label: "Kind", type: "text" },
            {
              field: "names",
              label: "Names",
              type: "text",
              descriptionField: "namesDetail",
            },
          ],
        }}
        data={{
          rows: [
            {
              title: "Alpha",
              reason: "https://example.com/a/very/long/path/that/never/breaks",
              kind: "Regulator",
              names: "BPOM",
              namesDetail: "Badan Pengawas Obat dan Makanan",
            },
          ],
        }}
      />,
    );

    const card = within(within(mobileCards()).getByRole("listitem"));
    const titleWrapper = card.getByText("Alpha").closest("div");
    const [reasonValue, kindValue, namesValue] =
      card.getAllByRole("definition");

    expect(titleWrapper).toHaveClass("wrap-anywhere");
    expect(titleWrapper).not.toHaveClass("truncate");
    expect(reasonValue).toHaveClass("wrap-break-word");
    expect(reasonValue).not.toHaveClass("truncate");
    expect(kindValue?.parentElement).not.toHaveClass("col-span-2");
    expect(namesValue).toHaveClass("wrap-anywhere");
    expect(namesValue?.parentElement).toHaveClass("col-span-2");
  });

  it("lets text columns wrap on wide screens while numbers and dates stay on one line", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "rows",
          columns: [
            { field: "entity", label: "Entity", type: "text" },
            { field: "articles", label: "Articles", type: "number" },
            { field: "code", label: "Code", type: "text", noWrap: true },
          ],
        }}
        data={{ rows: [{ entity: "BPOM", articles: 16, code: "X-1" }] }}
      />,
    );

    const cells = within(screen.getByRole("table")).getAllByRole("cell");

    expect(cells[0]).toHaveClass("whitespace-normal");
    expect(cells[1]).not.toHaveClass("whitespace-normal");
    expect(cells[2]).not.toHaveClass("whitespace-normal");
  });

  it("renders section-header rows as headings between the phone cards", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "rows",
          hideHeader: true,
          sectionHeaderField: "isSection",
          columns: [{ field: "label", label: "Article", type: "text" }],
        }}
        data={{
          rows: [
            { label: "Industry Pulse", isSection: true },
            { label: "Alpha", isSection: false },
          ],
        }}
      />,
    );

    const items = within(mobileCards()).getAllByRole("listitem");

    expect(items).toHaveLength(2);
    expect(items[0]).toHaveAttribute(
      "data-slot",
      "data-table-mobile-section-heading",
    );
    expect(items[0]).toHaveTextContent("Industry Pulse");
    expect(items[1]).toHaveTextContent("Alpha");
  });

  it("applies a column's minWidth to its header and cells", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "counters",
          columns: [
            { field: "label", label: "Counter", type: "text", minWidth: 280 },
            { field: "value", label: "Value", type: "text" },
          ],
        }}
        data={{ counters: [{ label: "Articles read", value: "12" }] }}
      />,
    );

    const header = table().getByRole("columnheader", { name: "Counter" });
    const cell = table().getByText("Articles read").closest("td");

    expect(header).toHaveStyle({ minWidth: "280px" });
    expect(cell).toHaveStyle({ minWidth: "280px" });
  });

  it("keeps noWrap values on one line only where the desktop table shows", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "rows",
          columns: [
            {
              field: "url",
              label: "Article URL",
              type: "text",
              noWrap: true,
              linkTemplate: "{url}",
              linkExternal: true,
            },
          ],
        }}
        data={{ rows: [{ url: "https://example.com/a" }] }}
      />,
    );

    const link = table().getByRole("link", { name: "https://example.com/a" });

    expect(link).toHaveClass("md:whitespace-nowrap");
    expect(link).not.toHaveClass("whitespace-nowrap");
  });

  it("renders a copyAction as an icon button beside the value", () => {
    render(
      <DetailBlockSubTableView
        block={{
          type: "subTable",
          field: "rows",
          columns: [
            { field: "id", label: "Id", type: "text", copyAction: true },
          ],
        }}
        data={{ rows: [{ id: "run-123" }] }}
      />,
    );

    const button = table().getByRole("button", { name: "Copy Id" });

    expect(button).toHaveClass("size-7");
    expect(button).toHaveTextContent("");
  });
});
