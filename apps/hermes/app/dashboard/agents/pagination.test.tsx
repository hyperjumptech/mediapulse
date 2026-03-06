import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentsPagination } from "./pagination";

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
    asChild,
  }: React.PropsWithChildren<{ disabled?: boolean; asChild?: boolean }>) => (
    <button disabled={disabled} data-as-child={asChild}>
      {children}
    </button>
  ),
}));

describe("AgentsPagination", () => {
  it("renders page info text", () => {
    // Act
    render(
      <AgentsPagination
        basePath="/dashboard/agents"
        page={1}
        pageSize={15}
        total={30}
        sortBy="agentId"
        sortDir="asc"
      />,
    );

    // Assert
    expect(screen.getByText("Page 1 of 2 (30 total)")).toBeInTheDocument();
  });

  it("renders Previous and Next buttons", () => {
    // Act
    render(
      <AgentsPagination
        basePath="/dashboard/agents"
        page={2}
        pageSize={15}
        total={45}
        sortBy="agentId"
        sortDir="asc"
      />,
    );

    // Assert
    expect(screen.getByText(/Previous/)).toBeInTheDocument();
    expect(screen.getByText(/Next/)).toBeInTheDocument();
  });

  it("disables Previous on first page", () => {
    // Act
    render(
      <AgentsPagination
        basePath="/dashboard/agents"
        page={1}
        pageSize={15}
        total={30}
        sortBy="agentId"
        sortDir="asc"
      />,
    );

    // Assert
    const prevButton = screen.getByText(/Previous/).closest("button");
    expect(prevButton).toBeDisabled();
  });

  it("enables Previous on page 2", () => {
    // Act
    render(
      <AgentsPagination
        basePath="/dashboard/agents"
        page={2}
        pageSize={15}
        total={30}
        sortBy="agentId"
        sortDir="asc"
      />,
    );

    // Assert
    const prevLink = screen.getByRole("link", { name: /Previous/ });
    expect(prevLink).toBeInTheDocument();
  });

  it("disables Next on last page", () => {
    // Act
    render(
      <AgentsPagination
        basePath="/dashboard/agents"
        page={2}
        pageSize={15}
        total={30}
        sortBy="agentId"
        sortDir="asc"
      />,
    );

    // Assert
    const nextButton = screen.getByText(/Next/).closest("button");
    expect(nextButton).toBeDisabled();
  });

  it("enables Next when not on last page", () => {
    // Act
    render(
      <AgentsPagination
        basePath="/dashboard/agents"
        page={1}
        pageSize={15}
        total={30}
        sortBy="agentId"
        sortDir="asc"
      />,
    );

    // Assert
    const nextLink = screen.getByRole("link", { name: /Next/ });
    expect(nextLink).toBeInTheDocument();
  });

  it("constructs correct Previous href", () => {
    // Act
    render(
      <AgentsPagination
        basePath="/dashboard/agents"
        page={3}
        pageSize={15}
        total={60}
        sortBy="agentId"
        sortDir="asc"
      />,
    );

    // Assert
    const prevLink = screen.getByRole("link", { name: /Previous/ });
    expect(prevLink).toHaveAttribute(
      "href",
      "/dashboard/agents?page=2&size=15&sort=agentId&dir=asc",
    );
  });

  it("constructs correct Next href", () => {
    // Act
    render(
      <AgentsPagination
        basePath="/dashboard/agents"
        page={1}
        pageSize={15}
        total={30}
        sortBy="agentId"
        sortDir="asc"
      />,
    );

    // Assert
    const nextLink = screen.getByRole("link", { name: /Next/ });
    expect(nextLink).toHaveAttribute(
      "href",
      "/dashboard/agents?page=2&size=15&sort=agentId&dir=asc",
    );
  });

  it("includes search query in pagination links", () => {
    // Act
    render(
      <AgentsPagination
        basePath="/dashboard/agents"
        page={1}
        pageSize={15}
        total={30}
        searchQuery="test"
        sortBy="agentId"
        sortDir="asc"
      />,
    );

    // Assert
    const nextLink = screen.getByRole("link", { name: /Next/ });
    expect(nextLink).toHaveAttribute(
      "href",
      "/dashboard/agents?page=2&size=15&q=test&sort=agentId&dir=asc",
    );
  });

  it("returns null when total fits in one page", () => {
    // Act
    const { container } = render(
      <AgentsPagination
        basePath="/dashboard/agents"
        page={1}
        pageSize={15}
        total={10}
        sortBy="agentId"
        sortDir="asc"
      />,
    );

    // Assert
    expect(container.firstChild).toBeNull();
  });

  it("renders navigation with aria-label", () => {
    // Act
    render(
      <AgentsPagination
        basePath="/dashboard/agents"
        page={1}
        pageSize={15}
        total={30}
        sortBy="agentId"
        sortDir="asc"
      />,
    );

    // Assert
    expect(
      screen.getByRole("navigation", { name: "Agents list pagination" }),
    ).toBeInTheDocument();
  });
});
