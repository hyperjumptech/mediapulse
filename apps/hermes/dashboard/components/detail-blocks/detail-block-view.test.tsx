import type { DetailBlock } from "@hermes/domain-contract";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DetailBlockView, DetailBlocksView } from "./detail-block-view";

describe("DetailBlockView", () => {
  it("renders a keyValue block", () => {
    render(
      <DetailBlockView
        block={{
          type: "keyValue",
          label: "Metadata",
          rows: [{ field: "subject", label: "Subject" }],
        }}
        data={{ subject: "Apple earnings" }}
      />,
    );
    expect(screen.getByText("Subject")).toBeInTheDocument();
    expect(screen.getByText("Apple earnings")).toBeInTheDocument();
  });

  it("renders a graph block", () => {
    const { container } = render(
      <DetailBlockView
        block={{
          type: "graph",
          label: "Knowledge graph",
          nodesField: "graph.nodes",
          edgesField: "graph.edges",
          orientation: "horizontal",
          maxNodes: 150,
          maxHeight: 520,
          node: { idField: "id", labelField: "label", rankField: "rank" },
          edge: { sourceField: "source", targetField: "target" },
        }}
        data={{
          graph: {
            nodes: [
              { id: "a", label: "Contract delay", rank: 0 },
              { id: "b", label: "Delay confirmed", rank: 1 },
            ],
            edges: [{ source: "a", target: "b" }],
          },
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Knowledge graph" }),
    ).toBeInTheDocument();
    expect(container.querySelector("svg")?.getAttribute("role")).toBe("group");
    expect(container.querySelectorAll("[data-graph-edge]")).toHaveLength(1);
  });

  it("renders a markdown block", () => {
    render(
      <DetailBlockView
        block={{
          type: "markdown",
          field: "body",
          label: "Body",
        }}
        data={{ body: "Hello [world](https://example.com)" }}
      />,
    );
    const link = screen.getByRole("link", { name: "world" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders an htmlPreview block with sandbox=allow-popups", () => {
    const { container } = render(
      <DetailBlockView
        block={{ type: "htmlPreview", field: "html", label: "Preview" }}
        data={{ html: "<p>hi</p>" }}
      />,
    );
    const iframe = container.querySelector("iframe");
    expect(iframe).toHaveAttribute("sandbox", "allow-popups");
  });

  it("renders a subTable block with linkColumn", () => {
    render(
      <DetailBlockView
        block={{
          type: "subTable",
          field: "rows",
          label: "Sources",
          columns: [
            { field: "title", label: "Title", type: "text" },
            {
              field: "id",
              label: "Open",
              type: "text",
              linkTemplate: "/dashboard/{integrationId}/data-sources/{id}",
            },
          ],
        }}
        data={{
          integrationId: "mediapulse",
          rows: [{ id: "abc", title: "Article" }],
        }}
      />,
    );
    const table = within(screen.getByRole("table"));
    const link = table.getByRole("link");

    expect(table.getByText("Article")).toBeInTheDocument();
    expect(link).toHaveAttribute(
      "href",
      "/dashboard/mediapulse/data-sources/abc",
    );
  });

  it("renders a tabs block via the tabs renderer", () => {
    render(
      <DetailBlockView
        block={{
          type: "tabs",
          label: "Content",
          tabs: [
            {
              label: "Body",
              block: { type: "markdown", field: "body" },
            },
            {
              label: "Preview",
              block: { type: "htmlPreview", field: "html" },
            },
          ],
        }}
        data={{ body: "Hello", html: "<p>hi</p>" }}
      />,
    );
    const triggers = screen.getAllByRole("tab");
    expect(triggers).toHaveLength(2);
    expect(triggers[0]).toHaveTextContent("Body");
    expect(triggers[1]).toHaveTextContent("Preview");
  });

  it("throws on unknown block type", () => {
    const unknownBlock = { type: "unknown" } as unknown as DetailBlock;

    expect(() =>
      render(<DetailBlockView block={unknownBlock} data={{}} />),
    ).toThrow();
  });
});

describe("DetailBlocksView", () => {
  it("separates top-level blocks with a 24px gap", () => {
    const { container } = render(
      <DetailBlocksView
        blocks={[{ type: "markdown", field: "body" }]}
        data={{ body: "Hello" }}
      />,
    );

    expect(container.firstElementChild).toHaveClass("flex-col", "gap-6");
  });

  it("renders blocks in order", () => {
    render(
      <DetailBlocksView
        blocks={[
          { type: "keyValue", label: "A", rows: [{ field: "a", label: "A" }] },
          { type: "markdown", field: "b" },
        ]}
        data={{ a: "alpha", b: "beta" }}
      />,
    );
    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
  });

  it("leaves out empty blocks and says so when nothing is left", () => {
    render(
      <DetailBlocksView
        blocks={[
          {
            type: "keyValue",
            label: "Collection gate",
            rows: [{ field: "gateStatus", label: "Status" }],
          },
          { type: "markdown", label: "Notes", field: "notes" },
        ]}
        data={{ gateStatus: null, notes: "" }}
      />,
    );

    expect(screen.queryByText("Collection gate")).not.toBeInTheDocument();
    expect(screen.queryByText("Notes")).not.toBeInTheDocument();
    expect(
      screen.getByText("This item has no values to show."),
    ).toBeInTheDocument();
  });

  it("drops a panel whose children are all empty", () => {
    render(
      <DetailBlocksView
        blocks={[
          {
            type: "panel",
            label: "Run",
            blocks: [
              {
                type: "keyValue",
                rows: [{ field: "reason", label: "Reason" }],
              },
            ],
          },
          { type: "markdown", field: "body" },
        ]}
        data={{ reason: null, body: "Kept" }}
      />,
    );

    expect(screen.queryByText("Run")).not.toBeInTheDocument();
    expect(screen.getByText("Kept")).toBeInTheDocument();
  });
});
