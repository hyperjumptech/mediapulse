import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { PipelineEditForm } from "./pipeline-edit-form";

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
  "@/app/dashboard/pipelines/actions/update/.generated/use-form-action",
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

const getUseFormActionMock = async () => {
  const mod =
    await import("@/app/dashboard/pipelines/actions/update/.generated/use-form-action");
  return mod.useFormAction as Mock;
};

describe("PipelineEditForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    routerRefreshMock.mockReset();
  });

  it("renders name input with initial value", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <PipelineEditForm
        pipelineId="pipeline-123"
        initialName="Test Pipeline"
        initialDescription="Test description"
        initialIsActive={true}
      />,
    );

    // Assert
    expect(screen.getByLabelText("Name")).toHaveValue("Test Pipeline");
  });

  it("renders description input with initial value", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <PipelineEditForm
        pipelineId="pipeline-123"
        initialName="Test"
        initialDescription="Test description"
        initialIsActive={true}
      />,
    );

    // Assert
    expect(screen.getByLabelText("Description")).toHaveValue(
      "Test description",
    );
  });

  it("renders Active checkbox checked when initially active", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <PipelineEditForm
        pipelineId="pipeline-123"
        initialName="Test"
        initialDescription=""
        initialIsActive={true}
      />,
    );

    // Assert
    expect(screen.getByLabelText("Active")).toBeChecked();
  });

  it("renders Active checkbox unchecked when initially inactive", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <PipelineEditForm
        pipelineId="pipeline-123"
        initialName="Test"
        initialDescription=""
        initialIsActive={false}
      />,
    );

    // Assert
    expect(screen.getByLabelText("Active")).not.toBeChecked();
  });

  it("renders hidden input with pipeline id", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    const { container } = render(
      <PipelineEditForm
        pipelineId="pipeline-123"
        initialName="Test"
        initialDescription=""
        initialIsActive={true}
      />,
    );

    // Assert
    const hiddenInput = container.querySelector(
      'input[name="body.pipelineId"]',
    );
    expect(hiddenInput).toHaveValue("pipeline-123");
  });

  it("shows Save changes button", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <PipelineEditForm
        pipelineId="pipeline-123"
        initialName="Test"
        initialDescription=""
        initialIsActive={true}
      />,
    );

    // Assert
    expect(
      screen.getByRole("button", { name: "Save changes" }),
    ).toBeInTheDocument();
  });

  it("shows Saving label when pending", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction({ pending: true }));

    // Act
    render(
      <PipelineEditForm
        pipelineId="pipeline-123"
        initialName="Test"
        initialDescription=""
        initialIsActive={true}
      />,
    );

    // Assert
    expect(screen.getByRole("button", { name: "Saving…" })).toBeInTheDocument();
  });

  it("displays error message when action fails", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(
      createMockUseFormAction({
        state: { status: false, message: "Pipeline name already exists" },
      }),
    );

    // Act
    render(
      <PipelineEditForm
        pipelineId="pipeline-123"
        initialName="Test"
        initialDescription=""
        initialIsActive={true}
      />,
    );

    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Pipeline name already exists",
    );
  });

  it("calls router.refresh on success", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction({ state: { status: true } }));

    // Act
    render(
      <PipelineEditForm
        pipelineId="pipeline-123"
        initialName="Test"
        initialDescription=""
        initialIsActive={true}
      />,
    );

    // Assert
    expect(routerRefreshMock).toHaveBeenCalled();
  });
});
