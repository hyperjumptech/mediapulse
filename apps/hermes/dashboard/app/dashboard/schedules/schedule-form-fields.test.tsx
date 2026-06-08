import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ScheduleFormFields,
  buildTimezoneSelectOptions,
  formatTimezoneSelectLabel,
  getSupportedIanaTimeZones,
  getTimezoneUtcOffsetLabel,
} from "./schedule-form-fields";

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

describe("getTimezoneUtcOffsetLabel", () => {
  const winterUtc = new Date("2024-01-15T12:00:00.000Z");
  const summerUtc = new Date("2024-07-15T12:00:00.000Z");

  it("returns a zero UTC offset label for UTC", () => {
    // Act
    const label = getTimezoneUtcOffsetLabel("UTC", winterUtc);

    // Assert — ICU varies by Node/runtime (e.g. "GMT" vs "GMT+00:00")
    expect(label === "GMT" || label === "GMT+00:00").toBe(true);
  });

  it("returns standard-time offset for America/New_York in January", () => {
    // Act
    const label = getTimezoneUtcOffsetLabel("America/New_York", winterUtc);

    // Assert
    expect(label).toBe("GMT-05:00");
  });

  it("returns daylight offset for America/New_York in July", () => {
    // Act
    const label = getTimezoneUtcOffsetLabel("America/New_York", summerUtc);

    // Assert
    expect(label).toBe("GMT-04:00");
  });

  it("returns empty string for an invalid IANA zone", () => {
    // Act
    const label = getTimezoneUtcOffsetLabel("Not/AZone", winterUtc);

    // Assert
    expect(label).toBe("");
  });
});

describe("getSupportedIanaTimeZones", () => {
  it("returns sorted zones from injected supportedValuesOf", () => {
    // Act
    const zones = getSupportedIanaTimeZones({
      supportedValuesOf: () => ["Zulu/Zone", "Alpha/Zone"],
    });

    // Assert
    expect(zones).toEqual(["Alpha/Zone", "Zulu/Zone"]);
  });

  it("uses fallback when supportedValuesOf returns empty", () => {
    // Act
    const zones = getSupportedIanaTimeZones({
      supportedValuesOf: () => [],
    });

    // Assert
    expect(zones).toContain("UTC");
    expect(zones).toContain("America/New_York");
  });

  it("uses fallback when supportedValuesOf is missing", () => {
    // Act
    const zones = getSupportedIanaTimeZones({});

    // Assert
    expect(zones).toContain("UTC");
  });

  it("uses fallback when supportedValuesOf throws", () => {
    // Act
    const zones = getSupportedIanaTimeZones({
      supportedValuesOf: () => {
        throw new Error("unsupported");
      },
    });

    // Assert
    expect(zones).toContain("UTC");
  });
});

describe("buildTimezoneSelectOptions", () => {
  it("merges default timezone when absent from zones and sorts", () => {
    // Act
    const options = buildTimezoneSelectOptions("Asia/Jakarta", ["UTC"]);

    // Assert
    expect(options).toEqual(["Asia/Jakarta", "UTC"]);
  });

  it("ignores whitespace-only default timezone", () => {
    // Act
    const options = buildTimezoneSelectOptions("   ", ["UTC", "Z"]);

    // Assert
    expect(options).toEqual(["UTC", "Z"]);
  });
});

describe("formatTimezoneSelectLabel", () => {
  const winterUtc = new Date("2024-01-15T12:00:00.000Z");

  it("includes IANA id and offset when offset resolves", () => {
    // Act
    const label = formatTimezoneSelectLabel("Asia/Tokyo", winterUtc);

    // Assert
    expect(label).toBe("Asia/Tokyo (GMT+09:00)");
  });

  it("falls back to IANA id only when offset is unavailable", () => {
    // Act
    const label = formatTimezoneSelectLabel("Not/AZone", winterUtc);

    // Assert
    expect(label).toBe("Not/AZone");
  });
});

const createMockPipelines = () => [
  {
    id: "pipeline-1",
    domainIntegrationId: "di-1",
    name: "Pipeline A",
    description: null,
    isActive: true,
    timeout: null,
    executionConfig: null,
    createdById: null,
    createdBy: null,
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
    timeout: null,
    executionConfig: null,
    createdById: null,
    createdBy: null,
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
    const repeatSelect = screen.getByLabelText("Repeat");
    expect(repeatSelect).toBeInTheDocument();
    expect(
      within(repeatSelect).getByRole("option", { name: "Once" }),
    ).toBeInTheDocument();
    expect(
      within(repeatSelect).getByRole("option", { name: "Repeating" }),
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

    // Assert — option *visible* text uses Intl longOffset; wording differs by ICU (CI vs local)
    const timezoneSelect = screen.getByLabelText("Timezone");
    expect(timezoneSelect).toBeInTheDocument();
    expect(
      timezoneSelect.querySelector('option[value="UTC"]'),
    ).toBeInTheDocument();
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
    const pipelineSelect = screen.getByLabelText("Pipeline");
    expect(pipelineSelect).toBeInTheDocument();
    expect(
      within(pipelineSelect).getByRole("option", { name: "Pipeline A" }),
    ).toBeInTheDocument();
    expect(
      within(pipelineSelect).getByRole("option", { name: "Pipeline B" }),
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
