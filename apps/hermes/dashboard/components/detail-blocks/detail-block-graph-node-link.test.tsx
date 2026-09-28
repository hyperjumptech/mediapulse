import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();
const prefetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, prefetch: prefetchMock }),
}));

import { DetailBlockGraphNodeLink } from "./detail-block-graph-node-link";

const renderNodeLink = (href: string, external?: boolean) =>
  render(
    <svg>
      <DetailBlockGraphNodeLink href={href} external={external}>
        <text>Node</text>
      </DetailBlockGraphNodeLink>
    </svg>,
  );

describe("DetailBlockGraphNodeLink", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("navigates client-side for internal links", () => {
    // Setup
    renderNodeLink("/dashboard/bench/entities/1");
    const link = screen.getByText("Node").closest("a");

    // Act
    fireEvent.click(link as Element, { button: 0 });

    // Assert
    expect(pushMock).toHaveBeenCalledWith("/dashboard/bench/entities/1");
    expect(link).toHaveAttribute("href", "/dashboard/bench/entities/1");
  });

  it("prefetches internal links on hover", () => {
    // Setup
    renderNodeLink("/dashboard/bench/entities/1");

    // Act
    fireEvent.pointerEnter(screen.getByText("Node").closest("a") as Element);

    // Assert
    expect(prefetchMock).toHaveBeenCalledWith("/dashboard/bench/entities/1");
  });

  it("lets modified clicks open a new tab natively", () => {
    // Setup
    renderNodeLink("/dashboard/bench/entities/1");

    // Act
    fireEvent.click(screen.getByText("Node").closest("a") as Element, {
      button: 0,
      metaKey: true,
    });

    // Assert
    expect(pushMock).not.toHaveBeenCalled();
  });

  it.each([
    ["an external URL", "https://example.com/item", false],
    ["a protocol-relative URL", "//example.com/item", false],
    ["an internal link marked external", "/dashboard/bench/entities/1", true],
  ])("leaves %s to the browser", (_label, href, external) => {
    // Setup
    renderNodeLink(href, external);
    const link = screen.getByText("Node").closest("a");

    // Act
    fireEvent.click(link as Element, { button: 0 });
    fireEvent.pointerEnter(link as Element);

    // Assert
    expect(pushMock).not.toHaveBeenCalled();
    expect(prefetchMock).not.toHaveBeenCalled();
  });

  it("opens external links in a new tab", () => {
    // Act
    renderNodeLink("https://example.com/item", true);

    // Assert
    const link = screen.getByText("Node").closest("a");

    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
