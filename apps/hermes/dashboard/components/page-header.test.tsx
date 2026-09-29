import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("renders the description without its own heading", () => {
    render(<PageHeader description="What runs and when." />);

    expect(screen.getByText("What runs and when.")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("renders actions in their own slot", () => {
    const { container } = render(
      <PageHeader actions={<button type="button">New</button>} />,
    );

    const actions = container.querySelector(
      '[data-slot="page-header-actions"]',
    );

    expect(actions).toContainElement(
      screen.getByRole("button", { name: "New" }),
    );
  });

  it("renders badges in their own slot", () => {
    const { container } = render(<PageHeader badges={<span>Enabled</span>} />);

    expect(
      container.querySelector('[data-slot="page-header-badges"]'),
    ).toHaveTextContent("Enabled");
  });

  it("puts the actions on the badge row and the description under it", () => {
    const { container } = render(
      <PageHeader
        badges={<span>Enabled</span>}
        description="Runs every night."
        actions={<button type="button">Edit</button>}
      />,
    );
    const badges = container.querySelector('[data-slot="page-header-badges"]');
    const actions = container.querySelector(
      '[data-slot="page-header-actions"]',
    );

    expect(badges?.parentElement).toBe(actions?.parentElement);
    expect(badges?.parentElement).not.toContainElement(
      screen.getByText("Runs every night."),
    );
  });

  it("renders nothing when it has nothing to show", () => {
    const { container } = render(<PageHeader />);

    expect(container).toBeEmptyDOMElement();
  });
});
