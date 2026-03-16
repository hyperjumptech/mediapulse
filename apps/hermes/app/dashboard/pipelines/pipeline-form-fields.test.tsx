import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineFormFields } from "./pipeline-form-fields";

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

describe("PipelineFormFields", () => {
  it("renders Name input", () => {
    // Act
    render(
      <PipelineFormFields
        pending={false}
        errorMessage={null}
        submitLabel="Create"
        defaultName=""
        defaultDescription=""
        defaultIsActive={true}
      />,
    );

    // Assert
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("renders Description input", () => {
    // Act
    render(
      <PipelineFormFields
        pending={false}
        errorMessage={null}
        submitLabel="Create"
        defaultName=""
        defaultDescription=""
        defaultIsActive={true}
      />,
    );

    // Assert
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
  });

  it("renders Active checkbox", () => {
    // Act
    render(
      <PipelineFormFields
        pending={false}
        errorMessage={null}
        submitLabel="Create"
        defaultName=""
        defaultDescription=""
        defaultIsActive={true}
      />,
    );

    // Assert
    expect(screen.getByLabelText("Active")).toBeInTheDocument();
  });

  it("renders submit button with provided label", () => {
    // Act
    render(
      <PipelineFormFields
        pending={false}
        errorMessage={null}
        submitLabel="Create pipeline"
        defaultName=""
        defaultDescription=""
        defaultIsActive={true}
      />,
    );

    // Assert
    expect(
      screen.getByRole("button", { name: "Create pipeline" }),
    ).toBeInTheDocument();
  });

  it("disables submit button when pending", () => {
    // Act
    render(
      <PipelineFormFields
        pending={true}
        errorMessage={null}
        submitLabel="Creating..."
        defaultName=""
        defaultDescription=""
        defaultIsActive={true}
      />,
    );

    // Assert
    expect(screen.getByRole("button", { name: "Creating..." })).toBeDisabled();
  });

  it("displays error message when provided", () => {
    // Act
    render(
      <PipelineFormFields
        pending={false}
        errorMessage="Name is required"
        submitLabel="Create"
        defaultName=""
        defaultDescription=""
        defaultIsActive={true}
      />,
    );

    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent("Name is required");
  });

  it("populates inputs with default values", () => {
    // Act
    render(
      <PipelineFormFields
        pending={false}
        errorMessage={null}
        submitLabel="Save"
        defaultName="My Pipeline"
        defaultDescription="A test pipeline"
        defaultIsActive={false}
      />,
    );

    // Assert
    expect(screen.getByLabelText("Name")).toHaveValue("My Pipeline");
    expect(screen.getByLabelText("Description")).toHaveValue("A test pipeline");
    expect(screen.getByLabelText("Active")).not.toBeChecked();
  });

  it("renders hidden pipelineId when provided", () => {
    // Act
    const { container } = render(
      <PipelineFormFields
        pending={false}
        errorMessage={null}
        submitLabel="Save"
        defaultName=""
        defaultDescription=""
        defaultIsActive={true}
        pipelineId="pipeline-123"
      />,
    );

    // Assert
    const hiddenInput = container.querySelector(
      'input[name="body.pipelineId"]',
    );
    expect(hiddenInput).toHaveValue("pipeline-123");
  });

  it("uses custom namePrefix for field names", () => {
    // Act
    const { container } = render(
      <PipelineFormFields
        namePrefix="custom"
        pending={false}
        errorMessage={null}
        submitLabel="Save"
        defaultName=""
        defaultDescription=""
        defaultIsActive={true}
      />,
    );

    // Assert
    expect(
      container.querySelector('input[name="custom.name"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('input[name="custom.description"]'),
    ).toBeInTheDocument();
  });
});
