import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { StepList } from "./step-list";

const routerRefreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: routerRefreshMock,
  }),
}));

const createMockFormWithAction = () => {
  const FormWithAction = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <form data-testid="remove-step-form" className={className}>
      {children}
    </form>
  );
  FormWithAction.displayName = "FormWithAction";
  return FormWithAction;
};

const createMockUseFormAction = (overrides?: {
  state?: { status: boolean } | null;
  pending?: boolean;
}) => ({
  FormWithAction: createMockFormWithAction(),
  state: overrides?.state ?? null,
  pending: overrides?.pending ?? false,
});

vi.mock(
  "@/app/dashboard/pipelines/actions/remove-step/.generated/use-form-action",
  () => ({
    useFormAction: vi.fn(() => createMockUseFormAction()),
  }),
);

vi.mock(
  "@/app/dashboard/pipelines/actions/update-step/.generated/use-form-action",
  () => ({
    useFormAction: vi.fn(() => createMockUseFormAction()),
  }),
);

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({
    children,
    type,
    disabled,
    "aria-label": ariaLabel,
  }: React.PropsWithChildren<{
    type?: string;
    disabled?: boolean;
    "aria-label"?: string;
  }>) => (
    <button type={type as "submit"} disabled={disabled} aria-label={ariaLabel}>
      {children}
    </button>
  ),
}));

const createMockSteps = () => [
  { id: "step-1", order: 0, agentId: "summarizer", agentVersion: "1.0" },
  { id: "step-2", order: 1, agentId: "translator", agentVersion: "2.0" },
];

const createMockAgents = () => [
  {
    id: "agent-1",
    agentId: "summarizer",
    agentVersion: "1.0",
    description: "Summarizes text",
  },
  {
    id: "agent-2",
    agentId: "translator",
    agentVersion: "2.0",
    description: null,
  },
];

const getUseFormActionMock = async () => {
  const mod =
    await import("@/app/dashboard/pipelines/actions/remove-step/.generated/use-form-action");
  return mod.useFormAction as Mock;
};

describe("StepList", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    routerRefreshMock.mockReset();
  });

  it("renders empty state when no steps", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <StepList
        pipelineId="pipeline-123"
        steps={[]}
        agentDescriptions={createMockAgents()}
      />,
    );

    // Assert
    expect(
      screen.getByText("No steps yet. Add an agent from the list below."),
    ).toBeInTheDocument();
  });

  it("renders step rows with order numbers", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <StepList
        pipelineId="pipeline-123"
        steps={createMockSteps()}
        agentDescriptions={createMockAgents()}
      />,
    );

    // Assert
    expect(screen.getByText("1.")).toBeInTheDocument();
    expect(screen.getByText("2.")).toBeInTheDocument();
  });

  it("renders agent ID and version for each step", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <StepList
        pipelineId="pipeline-123"
        steps={createMockSteps()}
        agentDescriptions={createMockAgents()}
      />,
    );

    // Assert
    expect(screen.getByText("summarizer@1.0")).toBeInTheDocument();
    expect(screen.getByText("translator@2.0")).toBeInTheDocument();
  });

  it("renders agent description when available", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <StepList
        pipelineId="pipeline-123"
        steps={createMockSteps()}
        agentDescriptions={createMockAgents()}
      />,
    );

    // Assert
    expect(screen.getByText("Summarizes text")).toBeInTheDocument();
  });

  it("renders Remove button for each step", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <StepList
        pipelineId="pipeline-123"
        steps={createMockSteps()}
        agentDescriptions={createMockAgents()}
      />,
    );

    // Assert
    expect(
      screen.getByRole("button", { name: "Remove step summarizer@1.0" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove step translator@2.0" }),
    ).toBeInTheDocument();
  });

  it("shows Removing label when pending", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction({ pending: true }));

    // Act
    render(
      <StepList
        pipelineId="pipeline-123"
        steps={[createMockSteps()[0]!]}
        agentDescriptions={createMockAgents()}
      />,
    );

    // Assert
    expect(screen.getByText("Removing…")).toBeInTheDocument();
  });

  it("calls router.refresh on successful remove", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction({ state: { status: true } }));

    // Act
    render(
      <StepList
        pipelineId="pipeline-123"
        steps={[createMockSteps()[0]!]}
        agentDescriptions={createMockAgents()}
      />,
    );

    // Assert
    expect(routerRefreshMock).toHaveBeenCalled();
  });

  it("renders Edit button for each step", async () => {
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    render(
      <StepList
        pipelineId="pipeline-123"
        steps={createMockSteps()}
        agentDescriptions={createMockAgents()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Edit step summarizer@1.0" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit step translator@2.0" }),
    ).toBeInTheDocument();
  });
});
