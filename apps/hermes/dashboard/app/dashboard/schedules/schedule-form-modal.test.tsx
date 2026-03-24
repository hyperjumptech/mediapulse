import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { ScheduleFormModal } from "./schedule-form-modal";

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
    <form data-testid="form-with-action" className={className}>
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
  "@/app/dashboard/schedules/actions/create/.generated/use-form-action",
  () => ({
    useFormAction: vi.fn(() => createMockUseFormAction()),
  }),
);

vi.mock(
  "@/app/dashboard/schedules/actions/update/.generated/use-form-action",
  () => ({
    useFormAction: vi.fn(() => createMockUseFormAction()),
  }),
);

vi.mock("@/app/dashboard/schedules/actions/get-for-edit", () => ({
  getScheduleForEdit: vi.fn(),
}));

vi.mock("@workspace/ui/components/dialog", () => ({
  Dialog: ({ children, open }: React.PropsWithChildren<{ open?: boolean }>) => (
    <div data-testid="dialog" data-open={open}>
      {children}
    </div>
  ),
  DialogContent: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: React.PropsWithChildren) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
}));

vi.mock("./schedule-form-fields", () => ({
  ScheduleFormFields: ({
    pending,
    errorMessage,
    submitLabel,
  }: {
    pending: boolean;
    errorMessage: string | null;
    submitLabel: string;
  }) => (
    <div
      data-testid="schedule-form-fields"
      data-pending={pending}
      data-error={errorMessage}
    >
      <button type="submit">{submitLabel}</button>
    </div>
  ),
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
];

const getCreateUseFormActionMock = async () => {
  const mod =
    await import("@/app/dashboard/schedules/actions/create/.generated/use-form-action");
  return mod.useFormAction as Mock;
};

describe("ScheduleFormModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    routerRefreshMock.mockReset();
  });

  it("renders dialog with create title", async () => {
    // Setup
    const mock = await getCreateUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <ScheduleFormModal
        open={true}
        onOpenChange={vi.fn()}
        mode="create"
        editScheduleId={null}
        pipelines={createMockPipelines()}
        pipelineValidationById={{}}
      />,
    );

    // Assert
    expect(screen.getByTestId("dialog-title")).toHaveTextContent(
      "Create schedule",
    );
  });

  it("renders dialog with edit title", async () => {
    // Setup
    const mock = await getCreateUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <ScheduleFormModal
        open={true}
        onOpenChange={vi.fn()}
        mode="edit"
        editScheduleId="schedule-123"
        pipelines={createMockPipelines()}
        pipelineValidationById={{}}
      />,
    );

    // Assert
    expect(screen.getByTestId("dialog-title")).toHaveTextContent(
      "Edit schedule",
    );
  });

  it("shows create button label when in create mode", async () => {
    // Setup
    const mock = await getCreateUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <ScheduleFormModal
        open={true}
        onOpenChange={vi.fn()}
        mode="create"
        editScheduleId={null}
        pipelines={createMockPipelines()}
        pipelineValidationById={{}}
      />,
    );

    // Assert
    expect(
      screen.getByRole("button", { name: "Create schedule" }),
    ).toBeInTheDocument();
  });

  it("passes open state to dialog", async () => {
    // Setup
    const mock = await getCreateUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <ScheduleFormModal
        open={true}
        onOpenChange={vi.fn()}
        mode="create"
        editScheduleId={null}
        pipelines={createMockPipelines()}
        pipelineValidationById={{}}
      />,
    );

    // Assert
    expect(screen.getByTestId("dialog")).toHaveAttribute("data-open", "true");
  });

  it("calls router.refresh on success after submit", async () => {
    // Setup
    const mock = await getCreateUseFormActionMock();
    mock.mockReturnValueOnce(
      createMockUseFormAction({
        state: { status: true },
        pending: true,
      }),
    );
    mock.mockReturnValueOnce(
      createMockUseFormAction({
        state: { status: true },
        pending: false,
      }),
    );

    // Act
    const { rerender } = render(
      <ScheduleFormModal
        open={true}
        onOpenChange={vi.fn()}
        mode="create"
        editScheduleId={null}
        pipelines={createMockPipelines()}
        pipelineValidationById={{}}
      />,
    );
    rerender(
      <ScheduleFormModal
        open={true}
        onOpenChange={vi.fn()}
        mode="create"
        editScheduleId={null}
        pipelines={createMockPipelines()}
        pipelineValidationById={{}}
      />,
    );

    // Assert
    expect(routerRefreshMock).toHaveBeenCalled();
  });
});
