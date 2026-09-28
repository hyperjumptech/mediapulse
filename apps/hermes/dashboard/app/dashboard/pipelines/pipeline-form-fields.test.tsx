import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineFormFields } from "./pipeline-form-fields";

vi.mock("next/link", () => ({
  default: ({ children, href }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@workspace/ui/lib/utils", () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(" "),
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

const defaultDomainIntegrations = [
  { id: "di-1", integrationId: "mediapulse", name: "Mediapulse" },
];

const baseProps = {
  pending: false,
  defaultName: "",
  defaultDescription: "",
  defaultIsActive: true,
  domainIntegrations: defaultDomainIntegrations,
};

describe("PipelineFormFields", () => {
  it("renders domain integration select", () => {
    render(<PipelineFormFields {...baseProps} />);
    expect(screen.getByLabelText("Domain integration")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("di-1");
  });

  it("shows link when no domain integrations", () => {
    render(<PipelineFormFields {...baseProps} domainIntegrations={[]} />);
    expect(
      screen.getByRole("link", { name: /Add one under Domain integrations/i }),
    ).toHaveAttribute("href", "/dashboard/domain-integrations");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("renders Name input", () => {
    render(<PipelineFormFields {...baseProps} />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("renders Description input", () => {
    render(<PipelineFormFields {...baseProps} />);
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
  });

  it("renders Active checkbox", () => {
    render(<PipelineFormFields {...baseProps} />);
    expect(screen.getByLabelText("Active")).toBeInTheDocument();
  });

  it("sends isActive false when unchecked via hidden before checkbox (last duplicate wins)", () => {
    const { container } = render(<PipelineFormFields {...baseProps} />);

    const activeInputs = container.querySelectorAll(
      'input[name="body.isActive"]',
    );
    expect(activeInputs).toHaveLength(2);
    expect(activeInputs[0]).toHaveAttribute("type", "hidden");
    expect(activeInputs[0]).toHaveValue("false");
    expect(activeInputs[1]).toHaveAttribute("type", "checkbox");
    expect(activeInputs[1]).toHaveAttribute("value", "true");
  });

  it("disables the inputs when pending", () => {
    render(<PipelineFormFields {...baseProps} pending={true} />);
    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(screen.getByLabelText("Name")).toBeDisabled();
    expect(screen.getByLabelText("Active")).toBeDisabled();
  });

  it("populates inputs with default values", () => {
    render(
      <PipelineFormFields
        {...baseProps}
        defaultName="My Pipeline"
        defaultDescription="A test pipeline"
        defaultIsActive={false}
      />,
    );
    expect(screen.getByLabelText("Name")).toHaveValue("My Pipeline");
    expect(screen.getByLabelText("Description")).toHaveValue("A test pipeline");
    expect(screen.getByLabelText("Active")).not.toBeChecked();
  });

  it("renders hidden pipelineId when provided", () => {
    const { container } = render(
      <PipelineFormFields {...baseProps} pipelineId="pipeline-123" />,
    );
    const hiddenInput = container.querySelector(
      'input[name="body.pipelineId"]',
    );
    expect(hiddenInput).toHaveValue("pipeline-123");
  });

  it("uses custom namePrefix for field names", () => {
    const { container } = render(
      <PipelineFormFields {...baseProps} namePrefix="custom" />,
    );
    expect(
      container.querySelector('input[name="custom.name"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('input[name="custom.description"]'),
    ).toBeInTheDocument();
  });

  it("renders Agent request timeout input", () => {
    render(<PipelineFormFields {...baseProps} />);
    expect(
      screen.getByLabelText("Agent request timeout (ms)"),
    ).toBeInTheDocument();
  });

  it("sets timeout defaultValue when defaultTimeoutMs is provided", () => {
    const { container } = render(
      <PipelineFormFields {...baseProps} defaultTimeoutMs={900_000} />,
    );
    const timeoutInput = container.querySelector('input[name="body.timeout"]');
    expect(timeoutInput).toHaveValue(900000);
  });

  it("updates timeout preview when typing", () => {
    render(<PipelineFormFields {...baseProps} />);
    const timeoutInput = screen.getByLabelText("Agent request timeout (ms)");
    fireEvent.input(timeoutInput, { target: { value: "300000" } });
    expect(screen.getByRole("status")).toHaveTextContent("5 minutes");
  });

  it("selects defaultDomainIntegrationId when provided", () => {
    render(
      <PipelineFormFields
        {...baseProps}
        domainIntegrations={[
          { id: "di-a", integrationId: "a", name: "A" },
          { id: "di-b", integrationId: "b", name: "B" },
        ]}
        defaultDomainIntegrationId="di-b"
      />,
    );
    expect(screen.getByRole("combobox")).toHaveValue("di-b");
  });
});
