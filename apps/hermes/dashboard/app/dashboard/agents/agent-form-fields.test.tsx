import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentFormFields } from "./agent-form-fields";

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({
    children,
    type,
    disabled,
  }: React.PropsWithChildren<{ type?: string; disabled?: boolean }>) => (
    <button type={type as "submit"} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@workspace/ui/components/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

vi.mock("@workspace/ui/components/label", () => ({
  Label: ({
    children,
    htmlFor,
  }: React.PropsWithChildren<{ htmlFor?: string }>) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

vi.mock("@workspace/ui/lib/utils", () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(" "),
}));

describe("AgentFormFields", () => {
  describe("create mode", () => {
    it("renders Agent ID input", () => {
      // Act
      render(
        <AgentFormFields
          mode="create"
          pending={false}
          errorMessage={null}
          submitLabel="Create agent"
        />,
      );

      // Assert
      expect(screen.getByLabelText("Agent ID")).toBeInTheDocument();
    });

    it("renders Agent version input", () => {
      // Act
      render(
        <AgentFormFields
          mode="create"
          pending={false}
          errorMessage={null}
          submitLabel="Create agent"
        />,
      );

      // Assert
      expect(screen.getByLabelText("Agent version")).toBeInTheDocument();
    });

    it("renders Description input", () => {
      // Act
      render(
        <AgentFormFields
          mode="create"
          pending={false}
          errorMessage={null}
          submitLabel="Create agent"
        />,
      );

      // Assert
      expect(
        screen.getByLabelText("Description (optional)"),
      ).toBeInTheDocument();
    });

    it("renders Endpoint textarea", () => {
      // Act
      render(
        <AgentFormFields
          mode="create"
          pending={false}
          errorMessage={null}
          submitLabel="Create agent"
        />,
      );

      // Assert
      expect(
        screen.getByLabelText("Endpoint (JSON object)"),
      ).toBeInTheDocument();
    });

    it("renders Active checkbox", () => {
      // Act
      render(
        <AgentFormFields
          mode="create"
          pending={false}
          errorMessage={null}
          submitLabel="Create agent"
        />,
      );

      // Assert
      expect(screen.getByLabelText("Active")).toBeInTheDocument();
    });

    it("renders submit button with provided label", () => {
      // Act
      render(
        <AgentFormFields
          mode="create"
          pending={false}
          errorMessage={null}
          submitLabel="Create agent"
        />,
      );

      // Assert
      expect(
        screen.getByRole("button", { name: "Create agent" }),
      ).toBeInTheDocument();
    });

    it("disables submit button when pending", () => {
      // Act
      render(
        <AgentFormFields
          mode="create"
          pending={true}
          errorMessage={null}
          submitLabel="Creating..."
        />,
      );

      // Assert
      expect(
        screen.getByRole("button", { name: "Creating..." }),
      ).toBeDisabled();
    });

    it("displays error message when provided", () => {
      // Act
      render(
        <AgentFormFields
          mode="create"
          pending={false}
          errorMessage="Invalid JSON format"
          submitLabel="Create agent"
        />,
      );

      // Assert
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Invalid JSON format",
      );
    });

    it("does not display error when errorMessage is null", () => {
      // Act
      render(
        <AgentFormFields
          mode="create"
          pending={false}
          errorMessage={null}
          submitLabel="Create agent"
        />,
      );

      // Assert
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("disables inputs when pending", () => {
      // Act
      render(
        <AgentFormFields
          mode="create"
          pending={true}
          errorMessage={null}
          submitLabel="Creating..."
        />,
      );

      // Assert
      expect(screen.getByLabelText("Agent ID")).toBeDisabled();
      expect(screen.getByLabelText("Agent version")).toBeDisabled();
    });
  });

  describe("edit mode", () => {
    const editProps = {
      mode: "edit" as const,
      id: "agent-123",
      initialAgentId: "test-agent",
      initialAgentVersion: "1.0",
      initialDescription: "Test description",
      initialEndpointJson: '{"url": "https://example.com"}',
      initialIsActive: true,
      pending: false,
      errorMessage: null,
      submitLabel: "Save changes",
    };

    it("renders hidden input with agent id", () => {
      // Act
      const { container } = render(<AgentFormFields {...editProps} />);

      // Assert
      const hiddenInput = container.querySelector('input[name="body.id"]');
      expect(hiddenInput).toHaveValue("agent-123");
    });

    it("populates Agent ID with initial value", () => {
      // Act
      render(<AgentFormFields {...editProps} />);

      // Assert
      expect(screen.getByLabelText("Agent ID")).toHaveValue("test-agent");
    });

    it("populates Agent version with initial value", () => {
      // Act
      render(<AgentFormFields {...editProps} />);

      // Assert
      expect(screen.getByLabelText("Agent version")).toHaveValue("1.0");
    });

    it("populates Description with initial value", () => {
      // Act
      render(<AgentFormFields {...editProps} />);

      // Assert
      expect(screen.getByLabelText("Description (optional)")).toHaveValue(
        "Test description",
      );
    });

    it("populates Endpoint with initial JSON value", () => {
      // Act
      render(<AgentFormFields {...editProps} />);

      // Assert
      expect(screen.getByLabelText("Endpoint (JSON object)")).toHaveValue(
        '{"url": "https://example.com"}',
      );
    });

    it("checks Active checkbox when initialIsActive is true", () => {
      // Act
      render(<AgentFormFields {...editProps} />);

      // Assert
      expect(screen.getByLabelText("Active")).toBeChecked();
    });

    it("unchecks Active checkbox when initialIsActive is false", () => {
      // Act
      render(<AgentFormFields {...editProps} initialIsActive={false} />);

      // Assert
      expect(screen.getByLabelText("Active")).not.toBeChecked();
    });
  });
});
