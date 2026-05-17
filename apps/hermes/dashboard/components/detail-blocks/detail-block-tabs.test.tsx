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
