import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScheduleFormFields } from "./schedule-form-fields";

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

const createMockPipelines = () => [
  {
    id: "pipeline-1",
    domainIntegrationId: "di-1",
    name: "Pipeline A",
    description: null,
    isActive: true,
    executionConfig: null,
    steps: [],
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-15"),
  },
  {
    id: "pipeline-2",
    domainIntegrationId: "di-1",
    name: "Pipeline B",
    description: null,
    isActive: true,
    executionConfig: null,
    steps: [],
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-15"),
  },
];

describe("ScheduleFormFields", () => {
  it("renders Name input", () => {
    // Act
    render(
      <ScheduleFormFields
        pending={false}
        errorMessage={null}
        submitLabel="Create"
        pipelines={createMockPipelines()}
        defaultName=""
        defaultDescription=""
        defaultRepeat="repeating"
        defaultTimezone="UTC"
        defaultPipelineId=""
        defaultPriority={0}
        defaultEnabled={true}
      />,
    );

    // Assert
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("renders Description input", () => {
    // Act
    render(
      <ScheduleFormFields
        pending={false}
        errorMessage={null}
        submitLabel="Create"
        pipelines={createMockPipelines()}
        defaultName=""
        defaultDescription=""
        defaultRepeat="repeating"
        defaultTimezone="UTC"
        defaultPipelineId=""
        defaultPriority={0}
        defaultEnabled={true}
      />,
    );

    // Assert
    expect(screen.getByLabelText("Description (optional)")).toBeInTheDocument();
  });

  it("renders Repeat select", () => {
    // Act
    render(
      <ScheduleFormFields
        pending={false}
        errorMessage={null}
        submitLabel="Create"
        pipelines={createMockPipelines()}
        defaultName=""
        defaultDescription=""
        defaultRepeat="repeating"
        defaultTimezone="UTC"
        defaultPipelineId=""
        defaultPriority={0}
        defaultEnabled={true}
      />,
    );

    // Assert
    expect(screen.getByLabelText("Repeat")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Once" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Repeating" }),
    ).toBeInTheDocument();
  });

  it("renders Timezone select", () => {
    // Act
    render(
      <ScheduleFormFields
        pending={false}
        errorMessage={null}
        submitLabel="Create"
        pipelines={createMockPipelines()}
        defaultName=""
        defaultDescription=""
        defaultRepeat="repeating"
        defaultTimezone="UTC"
        defaultPipelineId=""
        defaultPriority={0}
        defaultEnabled={true}
      />,
    );

    // Assert
    expect(screen.getByLabelText("Timezone")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "UTC" })).toBeInTheDocument();
  });

  it("renders Pipeline select with options", () => {
    // Act
    render(
      <ScheduleFormFields
        pending={false}
        errorMessage={null}
        submitLabel="Create"
        pipelines={createMockPipelines()}
        pipelineValidationById={{
          "pipeline-1": { valid: true, warnings: [] },
          "pipeline-2": { valid: true, warnings: [] },
        }}
        defaultName=""
        defaultDescription=""
        defaultRepeat="repeating"
        defaultTimezone="UTC"
        defaultPipelineId=""
        defaultPriority={0}
        defaultEnabled={true}
      />,
    );

    // Assert
    expect(screen.getByLabelText("Pipeline")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Pipeline A" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Pipeline B" }),
    ).toBeInTheDocument();
  });

  it("renders Pipeline select", () => {
    // Act
    render(
      <ScheduleFormFields
        pending={false}
        errorMessage={null}
        submitLabel="Create"
        pipelines={createMockPipelines()}
        defaultName=""
        defaultDescription=""
        defaultRepeat="repeating"
        defaultTimezone="UTC"
        defaultPipelineId=""
        defaultPriority={0}
        defaultEnabled={true}
      />,
    );

    // Assert
    expect(screen.getByLabelText("Pipeline")).toBeInTheDocument();
  });

  it("renders Priority input", () => {
    // Act
    render(
      <ScheduleFormFields
        pending={false}
        errorMessage={null}
        submitLabel="Create"
        pipelines={createMockPipelines()}
        defaultName=""
        defaultDescription=""
        defaultRepeat="repeating"
        defaultTimezone="UTC"
        defaultPipelineId=""
        defaultPriority={0}
        defaultEnabled={true}
      />,
    );

    // Assert
    expect(screen.getByLabelText(/Priority/)).toBeInTheDocument();
  });

  it("renders Enabled checkbox", () => {
    // Act
    render(
      <ScheduleFormFields
        pending={false}
        errorMessage={null}
        submitLabel="Create"
        pipelines={createMockPipelines()}
        defaultName=""
        defaultDescription=""
        defaultRepeat="repeating"
        defaultTimezone="UTC"
        defaultPipelineId=""
        defaultPriority={0}
        defaultEnabled={true}
      />,
    );

    // Assert
    expect(screen.getByLabelText("Enabled")).toBeInTheDocument();
  });

  it("renders submit button with provided label", () => {
    // Act
    render(
      <ScheduleFormFields
        pending={false}
        errorMessage={null}
        submitLabel="Create schedule"
        pipelines={createMockPipelines()}
        defaultName=""
        defaultDescription=""
        defaultRepeat="repeating"
        defaultTimezone="UTC"
        defaultPipelineId=""
        defaultPriority={0}
        defaultEnabled={true}
      />,
    );

    // Assert
    expect(
      screen.getByRole("button", { name: "Create schedule" }),
    ).toBeInTheDocument();
  });

  it("disables submit button when pending", () => {
    // Act
    render(
      <ScheduleFormFields
        pending={true}
        errorMessage={null}
        submitLabel="Creating..."
        pipelines={createMockPipelines()}
        defaultName=""
        defaultDescription=""
        defaultRepeat="repeating"
        defaultTimezone="UTC"
        defaultPipelineId=""
        defaultPriority={0}
        defaultEnabled={true}
      />,
    );

    // Assert
    expect(screen.getByRole("button", { name: "Creating..." })).toBeDisabled();
  });

  it("displays error message when provided", () => {
    // Act
    render(
      <ScheduleFormFields
        pending={false}
        errorMessage="Invalid cron expression"
        submitLabel="Create"
        pipelines={createMockPipelines()}
        defaultName=""
        defaultDescription=""
        defaultRepeat="repeating"
        defaultTimezone="UTC"
        defaultPipelineId=""
        defaultPriority={0}
        defaultEnabled={true}
      />,
    );

    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Invalid cron expression",
    );
  });

  it("renders hidden scheduleId when provided", () => {
    // Act
    const { container } = render(
      <ScheduleFormFields
        pending={false}
        errorMessage={null}
        submitLabel="Save"
        pipelines={createMockPipelines()}
        defaultName=""
        defaultDescription=""
        defaultRepeat="repeating"
        defaultTimezone="UTC"
        defaultPipelineId=""
        defaultPriority={0}
        defaultEnabled={true}
        scheduleId="schedule-123"
      />,
    );

    // Assert
    const hiddenInput = container.querySelector(
      'input[name="body.scheduleId"]',
    );
    expect(hiddenInput).toHaveValue("schedule-123");
  });

  it("populates inputs with default values", () => {
    // Act
    render(
      <ScheduleFormFields
        pending={false}
        errorMessage={null}
        submitLabel="Save"
        pipelines={createMockPipelines()}
        defaultName="Daily Run"
        defaultDescription="Runs daily at midnight"
        defaultRepeat="repeating"
        defaultTimezone="America/New_York"
        defaultPipelineId="pipeline-1"
        defaultPriority={5}
        defaultEnabled={false}
      />,
    );

    // Assert
    expect(screen.getByLabelText("Name")).toHaveValue("Daily Run");
    expect(screen.getByLabelText("Description (optional)")).toHaveValue(
      "Runs daily at midnight",
    );
    expect(screen.getByLabelText("Enabled")).not.toBeChecked();
  });
});
