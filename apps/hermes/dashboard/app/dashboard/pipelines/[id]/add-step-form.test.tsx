import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { AddStepForm } from "./add-step-form";

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
    <form data-testid="add-step-form" className={className}>
      {children}
    </form>
  );
  FormWithAction.displayName = "FormWithAction";
  return FormWithAction;
};

const createMockUseFormAction = (overrides?: {
  state?: { status: boolean; message?: string } | null;
  pending?: boolean;
}) => ({
  FormWithAction: createMockFormWithAction(),
  state: overrides?.state ?? null,
  pending: overrides?.pending ?? false,
});

vi.mock(
  "@/app/dashboard/pipelines/actions/add-step/.generated/use-form-action",
  () => ({
    useFormAction: vi.fn(() => createMockUseFormAction()),
  }),
);

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

vi.mock("@workspace/ui/components/label", () => ({
  Label: ({
    children,
    htmlFor,
  }: React.PropsWithChildren<{ htmlFor?: string }>) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

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
    await import("@/app/dashboard/pipelines/actions/add-step/.generated/use-form-action");
  return mod.useFormAction as Mock;
};

describe("AddStepForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    routerRefreshMock.mockReset();
  });

  it("renders Add agent label", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <AddStepForm
        pipelineId="pipeline-123"
        agents={createMockAgents()}
        existingStepAgentKeys={[]}
        configsByAgentKey={{}}
      />,
    );

    // Assert
    expect(screen.getByLabelText("Add agent")).toBeInTheDocument();
  });

  it("renders agent select dropdown", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <AddStepForm
        pipelineId="pipeline-123"
        agents={createMockAgents()}
        existingStepAgentKeys={[]}
        configsByAgentKey={{}}
      />,
    );

    // Assert
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText("Select an agent…")).toBeInTheDocument();
  });

  it("renders available agents as options", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <AddStepForm
        pipelineId="pipeline-123"
        agents={createMockAgents()}
        existingStepAgentKeys={[]}
        configsByAgentKey={{}}
      />,
    );

    // Assert
    expect(
      screen.getByRole("option", { name: /summarizer@1.0/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /translator@2.0/ }),
    ).toBeInTheDocument();
  });

  it("excludes already-added agents from options", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <AddStepForm
        pipelineId="pipeline-123"
        agents={createMockAgents()}
        existingStepAgentKeys={["summarizer@1.0"]}
        configsByAgentKey={{}}
      />,
    );

    // Assert
    expect(
      screen.queryByRole("option", { name: /summarizer@1.0/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /translator@2.0/ }),
    ).toBeInTheDocument();
  });

  it("renders Add step button", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <AddStepForm
        pipelineId="pipeline-123"
        agents={createMockAgents()}
        existingStepAgentKeys={[]}
        configsByAgentKey={{}}
      />,
    );

    // Assert
    expect(
      screen.getByRole("button", { name: "Add step" }),
    ).toBeInTheDocument();
  });

  it("shows Adding label when pending", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction({ pending: true }));

    // Act
    render(
      <AddStepForm
        pipelineId="pipeline-123"
        agents={createMockAgents()}
        existingStepAgentKeys={[]}
        configsByAgentKey={{}}
      />,
    );

    // Assert
    expect(screen.getByRole("button", { name: "Adding…" })).toBeInTheDocument();
  });

  it("shows message when all agents are already added", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <AddStepForm
        pipelineId="pipeline-123"
        agents={createMockAgents()}
        existingStepAgentKeys={["summarizer@1.0", "translator@2.0"]}
        configsByAgentKey={{}}
      />,
    );

    // Assert
    expect(
      screen.getByText("All registered agents are already in this pipeline."),
    ).toBeInTheDocument();
  });

  it("displays error message when action fails", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(
      createMockUseFormAction({
        state: { status: false, message: "Failed to add step" },
      }),
    );

    // Act
    render(
      <AddStepForm
        pipelineId="pipeline-123"
        agents={createMockAgents()}
        existingStepAgentKeys={[]}
        configsByAgentKey={{}}
      />,
    );

    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to add step");
  });

  it("resets the selected agent without calling router.refresh on success", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());
    const { rerender } = render(
      <AddStepForm
        pipelineId="pipeline-123"
        agents={createMockAgents()}
        existingStepAgentKeys={[]}
        configsByAgentKey={{}}
      />,
    );
    fireEvent.change(screen.getByLabelText("Add agent"), {
      target: { value: "summarizer@1.0" },
    });

    expect(screen.getByLabelText("Add agent")).toHaveValue("summarizer@1.0");

    mock.mockReturnValue(createMockUseFormAction({ state: { status: true } }));

    // Act
    rerender(
      <AddStepForm
        pipelineId="pipeline-123"
        agents={createMockAgents()}
        existingStepAgentKeys={[]}
        configsByAgentKey={{}}
      />,
    );

    // Assert
    expect(screen.getByLabelText("Add agent")).toHaveValue("");
    expect(routerRefreshMock).not.toHaveBeenCalled();
  });

  it("offers saved configs and hides the custom JSON once one is chosen", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());
    const { container } = render(
      <AddStepForm
        pipelineId="pipeline-123"
        agents={createMockAgents()}
        existingStepAgentKeys={[]}
        configsByAgentKey={{
          "summarizer@1.0": [
            {
              id: "config-1",
              name: "Short",
              description: "Two sentences",
              configSchemaFingerprint: null,
            },
          ],
        }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Add agent"), {
      target: { value: "summarizer@1.0" },
    });

    expect(screen.getByLabelText("Config (JSON, optional)")).toHaveValue("{}");

    // Act
    fireEvent.change(screen.getByLabelText("Saved config (optional)"), {
      target: { value: "config-1" },
    });

    // Assert
    const agentConfigInput = container.querySelector(
      'input[name="body.agentConfigId"]',
    );

    expect(
      screen.getByRole("option", { name: "Short — Two sentences" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Config (JSON, optional)"),
    ).not.toBeInTheDocument();
    expect(agentConfigInput).toHaveValue("config-1");
  });
});
