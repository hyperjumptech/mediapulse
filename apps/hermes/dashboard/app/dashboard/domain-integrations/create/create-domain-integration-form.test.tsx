import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreateDomainIntegrationForm } from "./create-domain-integration-form";

type ActionState =
  | { ok: false; error: string }
  | {
      ok: true;
      apiKeyPlaintext: string;
      integrationId: string;
      name: string;
    }
  | null;

const useActionStateMock = vi.fn((): [ActionState, () => void, boolean] => [
  null,
  vi.fn(),
  false,
]);

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();

  return {
    ...actual,
    useActionState: () => useActionStateMock(),
  };
});

vi.mock("./actions", () => ({
  createDomainIntegrationAction: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href}>{children}</a>
  ),
}));

describe("CreateDomainIntegrationForm", () => {
  afterEach(() => {
    useActionStateMock.mockReset();
  });

  it("renders the integration id and name fields with footer actions", () => {
    // Act
    render(<CreateDomainIntegrationForm />);

    // Assert
    expect(screen.getByLabelText("Integration id")).toHaveAttribute(
      "name",
      "integrationId",
    );
    expect(screen.getByLabelText("Display name")).toHaveAttribute(
      "name",
      "name",
    );
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/dashboard/domain-integrations",
    );
    expect(
      screen.getByRole("button", { name: "Create integration" }),
    ).toHaveAttribute("type", "submit");
  });

  it("tells the admin that creating the integration generates an API key", () => {
    // Act
    render(<CreateDomainIntegrationForm />);

    // Assert
    expect(
      screen.getByText(
        "Creating an integration generates an API key that your system uses to register with Hermes.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the action error and the pending label", () => {
    // Setup
    useActionStateMock.mockReturnValue([
      { ok: false, error: "Integration id already exists" },
      vi.fn(),
      true,
    ]);

    // Act
    render(<CreateDomainIntegrationForm />);

    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Integration id already exists",
    );
    expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
  });

  it("reveals the generated key once with a copy warning", () => {
    // Setup
    useActionStateMock.mockReturnValue([
      {
        ok: true,
        apiKeyPlaintext: "hdi_secret",
        integrationId: "acme-crm",
        name: "Acme CRM",
      },
      vi.fn(),
      false,
    ]);

    // Act
    render(<CreateDomainIntegrationForm />);

    // Assert
    expect(screen.getByText("hdi_secret")).toBeInTheDocument();
    expect(
      screen.getByText("Copy this key now. It won't be shown again."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy to clipboard" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Done" })).toHaveAttribute(
      "href",
      "/dashboard/domain-integrations",
    );
  });
});
