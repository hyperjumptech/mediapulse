/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
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
    expect(screen.getByText("Article")).toBeInTheDocument();
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute(
      "href",
      "/dashboard/mediapulse/data-sources/abc",
    );
  });

  it("throws on unknown block type", () => {
    expect(() =>
      render(
        <DetailBlockView
          // @ts-expect-error intentional bad type for false-positive guard
          block={{ type: "unknown" }}
          data={{}}
        />,
      ),
    ).toThrow();
  });
});

describe("DetailBlocksView", () => {
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
});
