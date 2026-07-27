/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DetailBlockTabsView } from "./detail-block-tabs";

describe("DetailBlockTabsView", () => {
  it("renders the outer label and tab triggers, defaulting to the first tab", () => {
    render(
      <DetailBlockTabsView
        block={{
          type: "tabs",
          label: "Content",
          tabs: [
            {
              label: "Body",
              block: { type: "markdown", field: "body", label: "Body label" },
            },
            {
              label: "Email preview",
              block: { type: "htmlPreview", field: "html" },
            },
          ],
        }}
        data={{ body: "Hello world", html: "<p>preview</p>" }}
      />,
    );

    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Body" })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(screen.getByRole("tab", { name: "Email preview" })).toHaveAttribute(
      "data-state",
      "inactive",
    );
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  const previewTabs = {
    type: "tabs" as const,
    tabs: [
      {
        label: "Email Preview",
        badge: { label: "en", variant: "outline" as const },
        block: { type: "htmlPreview" as const, field: "html" },
      },
      {
        label: "Email Preview",
        badge: { label: "id", variant: "outline" as const },
        visibleWhen: "present(htmlIndonesian)",
        block: { type: "htmlPreview" as const, field: "htmlIndonesian" },
      },
    ],
  };

  it("hides a tab whose visibleWhen rule is false", () => {
    render(
      <DetailBlockTabsView
        block={previewTabs}
        data={{ html: "<p>en</p>", htmlIndonesian: null }}
      />,
    );

    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(
      screen.getByRole("tab", { name: "Email Preview en" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("id")).toBeNull();
  });

  it("shows a tab whose visibleWhen rule is true", () => {
    render(
      <DetailBlockTabsView
        block={previewTabs}
        data={{ html: "<p>en</p>", htmlIndonesian: "<p>id</p>" }}
      />,
    );

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(
      screen.getByRole("tab", { name: "Email Preview id" }),
    ).toBeInTheDocument();
  });

  it("keeps a tab visible when its visibleWhen rule cannot be parsed", () => {
    render(
      <DetailBlockTabsView
        block={{
          type: "tabs",
          tabs: [
            {
              label: "Body",
              block: { type: "markdown", field: "body" },
            },
            {
              label: "Preview",
              visibleWhen: "totally && invalid",
              block: { type: "htmlPreview", field: "html" },
            },
          ],
        }}
        data={{ body: "Hello", html: "<p>preview</p>" }}
      />,
    );

    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });

  it("renders a tab badge so same-labelled tabs stay distinguishable", () => {
    render(
      <DetailBlockTabsView
        block={{
          type: "tabs",
          tabs: [
            {
              label: "Email Preview",
              block: { type: "htmlPreview", field: "html" },
            },
            {
              label: "Email Preview",
              badge: { label: "id", variant: "outline" },
              block: { type: "htmlPreview", field: "htmlIndonesian" },
            },
          ],
        }}
        data={{ html: "<p>en</p>", htmlIndonesian: "<p>id</p>" }}
      />,
    );

    expect(
      screen.getByRole("tab", { name: "Email Preview id" }),
    ).toBeInTheDocument();
    expect(screen.getByText("id")).toBeInTheDocument();
  });

  it("strips the inner block label so the tab trigger acts as the heading", () => {
    render(
      <DetailBlockTabsView
        block={{
          type: "tabs",
          tabs: [
            {
              label: "Body",
              block: {
                type: "markdown",
                field: "body",
                label: "Should not render",
              },
            },
          ],
        }}
        data={{ body: "Hello" }}
      />,
    );

    expect(screen.queryByText("Should not render")).toBeNull();
    expect(screen.getByRole("tab", { name: "Body" })).toBeInTheDocument();
  });

  it("renders one tab trigger and one tab panel per tab in declaration order", () => {
    render(
      <DetailBlockTabsView
        block={{
          type: "tabs",
          tabs: [
            {
              label: "Body",
              block: { type: "markdown", field: "body" },
            },
            {
              label: "Email preview",
              block: { type: "htmlPreview", field: "html" },
            },
          ],
        }}
        data={{ body: "Hello", html: "<p>preview</p>" }}
      />,
    );

    const triggers = screen.getAllByRole("tab");
    expect(triggers).toHaveLength(2);
    expect(triggers[0]).toHaveTextContent("Body");
    expect(triggers[1]).toHaveTextContent("Email preview");
    expect(triggers[0]).toHaveAttribute("data-state", "active");
    expect(triggers[1]).toHaveAttribute("data-state", "inactive");
  });

  it("renders the active tab's row-count selector on the tab bar for a subTable tab", () => {
    render(
      <DetailBlockTabsView
        block={{
          type: "tabs",
          tabs: [
            {
              label: "Collected",
              block: {
                type: "subTable",
                field: "sources",
                rowLimitOptions: [5, 10],
                rowLimitDefaultAll: true,
                columns: [
                  {
                    field: "title",
                    label: "Article",
                    type: "text",
                    linkTemplate: "{url}",
                    linkExternal: true,
                  },
                ],
              },
            },
          ],
        }}
        data={{
          sources: [{ id: "s1", title: "Alpha", url: "https://example.com/a" }],
        }}
      />,
    );

    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Alpha" })).toHaveAttribute(
      "href",
      "https://example.com/a",
    );
  });

  it("shows no selector when the active tab has no row-count options", () => {
    render(
      <DetailBlockTabsView
        block={{
          type: "tabs",
          tabs: [{ label: "Body", block: { type: "markdown", field: "body" } }],
        }}
        data={{ body: "Hello" }}
      />,
    );

    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("evaluates the outer section rule against the full response", () => {
    render(
      <DetailBlockTabsView
        block={{
          type: "tabs",
          label: "Content",
          sectionRule: {
            when: "draft == true",
            badge: "warning",
            label: "draft only",
          },
          tabs: [
            {
              label: "Body",
              block: { type: "markdown", field: "body" },
            },
          ],
        }}
        data={{ draft: true, body: "Hello" }}
      />,
    );

    expect(screen.getByText("draft only")).toBeInTheDocument();
  });
});
