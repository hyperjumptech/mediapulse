import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AgentConfigForm } from "./agent-config-form";

vi.mock("next/link", () => ({
  default: ({ children, href }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("./agent-config-form-fields", () => ({
  AgentConfigFormFields: () => <div data-testid="agent-config-form-fields" />,
}));

const MockFormWithAction = ({
  children,
  className,
}: {
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLFormElement>) => (
  <form className={className} data-testid="agent-config-form">
    {children}
  </form>
);

const pickerLoaders = {
  loadVariablesPage: vi.fn(),
  loadExpansionsPage: vi.fn(),
};

const filledFormState = {
  name: "Short",
  description: "Two sentences",
  agentKey: "summarizer@1.0",
  config: { sentences: 2 },
};

const renderForm = (
  overrides: Partial<React.ComponentProps<typeof AgentConfigForm>> = {},
) =>
  render(
    <AgentConfigForm
      FormWithAction={MockFormWithAction}
      formState={filledFormState}
      setFormState={vi.fn()}
      pending={false}
      errorMessage={null}
      agents={[]}
      pickerLoaders={pickerLoaders}
      submitLabel="Create config"
      pendingLabel="Creating…"
      {...overrides}
    />,
  );

describe("AgentConfigForm", () => {
  it("posts the form state through hidden inputs", () => {
    // Act
    renderForm({ configId: "config-1" });

    // Assert
    const formData = new FormData(
      screen.getByTestId("agent-config-form") as HTMLFormElement,
    );

    expect(formData.get("body.id")).toBe("config-1");
    expect(formData.get("body.name")).toBe("Short");
    expect(formData.get("body.agentId")).toBe("summarizer");
    expect(formData.get("body.agentVersion")).toBe("1.0");
    expect(formData.get("body.config")).toBe('{"sentences":2}');
  });

  it("renders Cancel as a link back to the list and an enabled submit", () => {
    // Act
    renderForm();

    // Assert
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/dashboard/agent-configs",
    );
    expect(screen.getByRole("button", { name: "Create config" })).toBeEnabled();
  });

  it("disables the submit until a name and agent are chosen", () => {
    // Act
    renderForm({
      formState: { ...filledFormState, agentKey: "" },
    });

    // Assert
    expect(
      screen.getByRole("button", { name: "Create config" }),
    ).toBeDisabled();
  });

  it("shows the pending label and the action error", () => {
    // Act
    renderForm({ pending: true, errorMessage: "Config is invalid" });

    // Assert
    expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Config is invalid");
  });
});
