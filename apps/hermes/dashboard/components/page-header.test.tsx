import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("renders title as h1", () => {
    // Act
    render(
      <PageHeader
        title="Test Page"
        description="A short description for the page."
      />,
    );

    // Assert
    expect(
      screen.getByRole("heading", { name: "Test Page", level: 1 }),
    ).toBeInTheDocument();
  });

  it("renders description text", () => {
    // Act
    render(
      <PageHeader
        title="Test Page"
        description="A short description for the page."
      />,
    );

    // Assert
    expect(
      screen.getByText("A short description for the page."),
    ).toBeInTheDocument();
  });

  it("applies expected heading classes", () => {
    // Act
    render(
      <PageHeader
        title="Test Page"
        description="A short description for the page."
      />,
    );

    // Assert
    const heading = screen.getByRole("heading", { name: "Test Page" });

    expect(heading).toHaveClass("text-2xl");
    expect(heading).toHaveClass("font-semibold");
  });

  it.each([undefined, ""])(
    "omits the description paragraph when description is %j",
    (description) => {
      // Act
      const { container } = render(
        <PageHeader title="Test Page" description={description} />,
      );

      // Assert
      expect(container.querySelector("p")).toBeNull();
    },
  );

  it("renders actions in a right-aligned slot that stacks on mobile", () => {
    // Act
    render(
      <PageHeader
        title="Test Page"
        actions={<button type="button">Create pipeline</button>}
      />,
    );

    // Assert
    const action = screen.getByRole("button", { name: "Create pipeline" });
    const actionsSlot = action.parentElement;
    const headerRow = actionsSlot?.parentElement;

    expect(actionsSlot).toHaveAttribute("data-slot", "page-header-actions");
    expect(headerRow).toHaveClass(
      "flex-col",
      "md:flex-row",
      "md:justify-between",
    );
  });

  it("omits the actions slot without actions", () => {
    // Act
    const { container } = render(<PageHeader title="Test Page" />);

    // Assert
    expect(
      container.querySelector('[data-slot="page-header-actions"]'),
    ).toBeNull();
  });

  it("renders badges beside the title outside the heading", () => {
    // Act
    render(
      <PageHeader
        title="Daily digest"
        badges={<span data-testid="status-badge">Enabled</span>}
      />,
    );

    // Assert
    const heading = screen.getByRole("heading", { level: 1 });
    const badge = screen.getByTestId("status-badge");

    expect(heading).toHaveTextContent("Daily digest");
    expect(heading).not.toContainElement(badge);
    expect(badge.parentElement).toHaveAttribute(
      "data-slot",
      "page-header-badges",
    );
  });

  it("omits the badges slot without badges", () => {
    // Act
    const { container } = render(<PageHeader title="Test Page" />);

    // Assert
    expect(
      container.querySelector('[data-slot="page-header-badges"]'),
    ).toBeNull();
  });

  it("renders a rich title node inside the heading", () => {
    // Act
    render(
      <PageHeader title={<span className="font-mono">summarizer@1.0</span>} />,
    );

    // Assert
    const heading = screen.getByRole("heading", {
      level: 1,
      name: "summarizer@1.0",
    });

    expect(heading.querySelector(".font-mono")).not.toBeNull();
  });
});
