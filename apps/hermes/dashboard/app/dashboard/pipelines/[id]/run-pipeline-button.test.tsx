import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { RunPipelineButton } from "./run-pipeline-button";

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
    <form data-testid="run-pipeline-form" className={className}>
      {children}
    </form>
  );
  FormWithAction.displayName = "FormWithAction";
  return FormWithAction;
};

const createMockUseFormAction = (overrides?: {
  state?: {
    status: boolean;
    message?: string;
    data?: { tickersRun?: number };
  } | null;
  pending?: boolean;
}) => ({
  FormWithAction: createMockFormWithAction(),
  state: overrides?.state ?? null,
  pending: overrides?.pending ?? false,
});

vi.mock(
  "@/app/dashboard/pipelines/actions/run-pipeline/.generated/use-form-action",
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

const getUseFormActionMock = async () => {
  const mod =
    await import("@/app/dashboard/pipelines/actions/run-pipeline/.generated/use-form-action");
  return mod.useFormAction as Mock;
};

describe("RunPipelineButton", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    routerRefreshMock.mockReset();
  });

  it("renders Run pipeline button", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(<RunPipelineButton pipelineId="pipeline-123" />);

    // Assert
    expect(
      screen.getByRole("button", { name: /Run pipeline/i }),
    ).toBeInTheDocument();
  });

  it("renders hidden input with pipeline id", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(<RunPipelineButton pipelineId="pipeline-123" />);

    // Assert
    const form = screen.getByTestId("run-pipeline-form");
    const hiddenInput = form.querySelector('input[name="body.pipelineId"]');
    expect(hiddenInput).toHaveValue("pipeline-123");
  });

  it("shows Running label when pending", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction({ pending: true }));

    // Act
    render(<RunPipelineButton pipelineId="pipeline-123" />);

    // Assert
    expect(
      screen.getByRole("button", { name: /Running…/i }),
    ).toBeInTheDocument();
  });

  it("disables button when pending", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction({ pending: true }));

    // Act
    render(<RunPipelineButton pipelineId="pipeline-123" />);

    // Assert
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("displays error message on failure", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(
      createMockUseFormAction({
        state: { status: false, message: "Pipeline is inactive" },
      }),
    );

    // Act
    render(<RunPipelineButton pipelineId="pipeline-123" />);

    // Assert
    expect(screen.getByText("Pipeline is inactive")).toBeInTheDocument();
  });

  it("displays success message with ticker count", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(
      createMockUseFormAction({
        state: { status: true, data: { tickersRun: 5 } },
      }),
    );

    // Act
    render(<RunPipelineButton pipelineId="pipeline-123" />);

    // Assert
    expect(screen.getByText("Ran for 5 tickers.")).toBeInTheDocument();
  });

  it("displays singular ticker message for 1 ticker", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(
      createMockUseFormAction({
        state: { status: true, data: { tickersRun: 1 } },
      }),
    );

    // Act
    render(<RunPipelineButton pipelineId="pipeline-123" />);

    // Assert
    expect(screen.getByText("Ran for 1 ticker.")).toBeInTheDocument();
  });

  it("calls router.refresh on success", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction({ state: { status: true } }));

    // Act
    render(<RunPipelineButton pipelineId="pipeline-123" />);

    // Assert
    expect(routerRefreshMock).toHaveBeenCalled();
  });
});
