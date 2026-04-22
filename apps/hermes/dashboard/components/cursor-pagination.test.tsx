import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CursorPagination } from "./cursor-pagination";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({
    children,
    disabled,
  }: React.PropsWithChildren<{ disabled?: boolean; asChild?: boolean }>) => (
    <button disabled={disabled}>{children}</button>
  ),
}));

describe("CursorPagination", () => {
  it("returns null when no prev or next cursor", () => {
    // Act
    const { container } = render(
      <CursorPagination
        basePath="/dashboard/agents/content-generation-runs"
        limit={20}
        ariaLabel="CGA runs pagination"
      />,
    );

    // Assert
    expect(container.firstChild).toBeNull();
  });

  it("renders next link when nextCursor is present", () => {
    // Act
    render(
      <CursorPagination
        basePath="/dashboard/agents/content-generation-runs"
        nextCursor="next-123"
        limit={20}
        ariaLabel="CGA runs pagination"
      />,
    );

    // Assert
    const nextLink = screen.getByRole("link", { name: /Next/ });
    expect(nextLink).toBeInTheDocument();
    expect(nextLink).toHaveAttribute(
      "href",
      expect.stringContaining("cursor=next-123"),
    );
  });

  it("renders previous link when currentCursor is present", () => {
    // Act
    render(
      <CursorPagination
        basePath="/dashboard/agents/content-generation-runs"
        currentCursor="current-456"
        nextCursor="next-789"
        limit={20}
        ariaLabel="CGA runs pagination"
      />,
    );

    // Assert
    expect(screen.getByText(/Previous/)).toBeInTheDocument();
  });

  it("disables previous button on first page (no currentCursor)", () => {
    // Act
    render(
      <CursorPagination
        basePath="/dashboard/agents/content-generation-runs"
        nextCursor="next-123"
        limit={20}
        ariaLabel="CGA runs pagination"
      />,
    );

    // Assert
    const prevButton = screen.getByText(/Previous/).closest("button");
    expect(prevButton).toBeDisabled();
  });

  it("disables next button when no nextCursor", () => {
    // Act
    render(
      <CursorPagination
        basePath="/dashboard/agents/content-generation-runs"
        currentCursor="current-456"
        limit={20}
        ariaLabel="CGA runs pagination"
      />,
    );

    // Assert
    const nextButton = screen.getByText(/Next/).closest("button");
    expect(nextButton).toBeDisabled();
  });

  it("preserves extraParams in next link", () => {
    // Act
    render(
      <CursorPagination
        basePath="/dashboard/agents/content-generation-runs"
        nextCursor="next-123"
        limit={20}
        extraParams={{ outcome: "failed", tickerId: "abc-def" }}
        ariaLabel="CGA runs pagination"
      />,
    );

    // Assert
    const nextLink = screen.getByRole("link", { name: /Next/ });
    expect(nextLink).toHaveAttribute(
      "href",
      expect.stringContaining("outcome=failed"),
    );
    expect(nextLink).toHaveAttribute(
      "href",
      expect.stringContaining("tickerId=abc-def"),
    );
  });

  it("includes limit in pagination links", () => {
    // Act
    render(
      <CursorPagination
        basePath="/dashboard/agents/content-generation-runs"
        nextCursor="next-123"
        limit={50}
        ariaLabel="CGA runs pagination"
      />,
    );

    // Assert
    const nextLink = screen.getByRole("link", { name: /Next/ });
    expect(nextLink).toHaveAttribute(
      "href",
      expect.stringContaining("limit=50"),
    );
  });

  it("renders navigation with aria-label", () => {
    // Act
    render(
      <CursorPagination
        basePath="/dashboard/agents/content-generation-runs"
        nextCursor="next-123"
        limit={20}
        ariaLabel="CGA runs pagination"
      />,
    );

    // Assert
    expect(
      screen.getByRole("navigation", { name: "CGA runs pagination" }),
    ).toBeInTheDocument();
  });

  it("next link carries currentCursor as prevCursor for backward navigation", () => {
    // Act
    render(
      <CursorPagination
        basePath="/dashboard/agents/content-generation-runs"
        currentCursor="cursor-A"
        nextCursor="cursor-B"
        limit={20}
        ariaLabel="CGA runs pagination"
      />,
    );

    // Assert
    const nextLink = screen.getByRole("link", { name: /Next/ });
    expect(nextLink).toHaveAttribute(
      "href",
      expect.stringContaining("cursor=cursor-B"),
    );
    expect(nextLink).toHaveAttribute(
      "href",
      expect.stringContaining("prevCursor=cursor-A"),
    );
  });

  it("previous link uses prevCursor when provided", () => {
    // Act
    render(
      <CursorPagination
        basePath="/dashboard/agents/content-generation-runs"
        currentCursor="cursor-B"
        prevCursor="cursor-A"
        nextCursor="cursor-C"
        limit={20}
        ariaLabel="CGA runs pagination"
      />,
    );

    // Assert
    const prevLink = screen.getByRole("link", { name: /Previous/ });
    expect(prevLink).toHaveAttribute(
      "href",
      expect.stringContaining("cursor=cursor-A"),
    );
    expect(prevLink).toHaveAttribute(
      "href",
      expect.not.stringContaining("prevCursor="),
    );
  });

  it("previous link goes to page 1 (no cursor) when on page 2 without prevCursor", () => {
    // Act — page 2: currentCursor set but no prevCursor (back to page 1)
    render(
      <CursorPagination
        basePath="/dashboard/agents/content-generation-runs"
        currentCursor="cursor-A"
        nextCursor="cursor-B"
        limit={20}
        ariaLabel="CGA runs pagination"
      />,
    );

    // Assert — previous link navigates to page 1 (no cursor param)
    const prevLink = screen.getByRole("link", { name: /Previous/ });
    expect(prevLink).toHaveAttribute(
      "href",
      expect.stringContaining("limit=20"),
    );
    expect(prevLink).not.toHaveAttribute(
      "href",
      expect.stringContaining("cursor="),
    );
  });
});
