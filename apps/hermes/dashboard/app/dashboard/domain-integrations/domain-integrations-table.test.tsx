import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("./domain-integration-row-actions", () => ({
  DomainIntegrationRowActions: ({
    row,
  }: {
    row: { id: string; integrationId: string; name: string };
  }) => (
    <div
      data-testid={`domain-integration-row-actions-${row.id}`}
      data-integration-id={row.integrationId}
      data-name={row.name}
    />
  ),
}));

import { DomainIntegrationsTable } from "./domain-integrations-table";

const integrations = [
  {
    id: "integration-1",
    integrationId: "mediapulse",
    name: "Mediapulse",
    status: "active",
    baseUrl: "https://mediapulse.example.com",
  },
  {
    id: "integration-2",
    integrationId: "sandbox",
    name: "Sandbox",
    status: "pending",
    baseUrl: null,
  },
];

const renderIntegrations = (
  overrides: Partial<React.ComponentProps<typeof DomainIntegrationsTable>> = {},
) =>
  render(
    <DomainIntegrationsTable integrations={integrations} {...overrides} />,
  );

const table = () => screen.getByRole("table");

describe("DomainIntegrationsTable", () => {
  it("shows name, status and base URL columns without created by", () => {
    renderIntegrations();

    const headers = within(table())
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(headers).toEqual(["Name", "Status", "Base URL", "Actions"]);
  });

  it("shows the integration id under the name with a copy button", () => {
    renderIntegrations();

    const nameCell = within(table()).getByText("Mediapulse").closest("td");

    expect(nameCell).toHaveTextContent("mediapulse");
    expect(
      within(nameCell as HTMLElement).getByRole("button", {
        name: "Copy integration id mediapulse",
      }),
    ).toBeInTheDocument();
  });

  it("renders status badges", () => {
    renderIntegrations();

    expect(within(table()).getByText("active")).toHaveAttribute(
      "data-variant",
      "success",
    );
    expect(within(table()).getByText("pending")).toHaveAttribute(
      "data-variant",
      "muted",
    );
  });

  it("truncates the base URL and hides it below large screens", () => {
    renderIntegrations();

    const baseUrl = within(table()).getByText("https://mediapulse.example.com");
    const sandboxRow = within(table()).getByText("Sandbox").closest("tr");

    expect(baseUrl).toHaveAttribute("title", "https://mediapulse.example.com");
    expect(baseUrl).toHaveClass("truncate");
    expect(
      within(table()).getByRole("columnheader", { name: "Base URL" }),
    ).toHaveClass("hidden", "lg:table-cell");
    expect(sandboxRow).toHaveTextContent("—");
  });

  it("passes the integration to the row actions", () => {
    renderIntegrations();

    const rowActions = within(table()).getByTestId(
      "domain-integration-row-actions-integration-2",
    );

    expect(rowActions).toHaveAttribute("data-integration-id", "sandbox");
    expect(rowActions).toHaveAttribute("data-name", "Sandbox");
  });

  it("renders the empty state with a link to create one", () => {
    renderIntegrations({ integrations: [] });

    expect(screen.getByText("No integrations yet")).toBeInTheDocument();
    expect(
      screen.getByText("Create one to get an API key."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "New integration" }),
    ).toHaveAttribute("href", "/dashboard/domain-integrations/create");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
