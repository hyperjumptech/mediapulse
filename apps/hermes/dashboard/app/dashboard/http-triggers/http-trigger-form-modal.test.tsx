import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";

import { HttpTriggerFormModal } from "./http-trigger-form-modal";

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

vi.mock("./actions/create/.generated/use-form-action", () => ({
  useFormAction: vi.fn(() => createMockUseFormAction()),
}));

vi.mock("./actions/update/.generated/use-form-action", () => ({
  useFormAction: vi.fn(() => createMockUseFormAction()),
}));

vi.mock("./actions/get-for-edit", () => ({
  getHttpTriggerForEdit: vi.fn(),
}));

vi.mock("@workspace/ui/components/dialog", () => ({
  Dialog: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dialog">{children}</div>
  ),
  DialogContent: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: React.PropsWithChildren) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
}));

vi.mock("./http-trigger-form-fields", () => ({
  HttpTriggerFormFields: ({
    defaultName,
    httpTriggerId,
  }: {
    defaultName: string;
    httpTriggerId?: string;
  }) => (
    <div
      data-testid="http-trigger-form-fields"
      data-default-name={defaultName}
      data-trigger-id={httpTriggerId ?? ""}
    />
  ),
}));

const pipelines = [{ id: "pipeline-1", name: "Pipeline A", isActive: true }];

const getCreateUseFormActionMock = async () => {
  const generatedModule =
    await import("./actions/create/.generated/use-form-action");

  return generatedModule.useFormAction as Mock;
};

const getHttpTriggerForEditMock = async () => {
  const getForEditModule = await import("./actions/get-for-edit");

  return getForEditModule.getHttpTriggerForEdit as Mock;
};

describe("HttpTriggerFormModal", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("renders the create title and submit label", () => {
    // Act
    render(
      <HttpTriggerFormModal
        open={true}
        onOpenChange={vi.fn()}
        mode="create"
        editHttpTriggerId={null}
        pipelines={pipelines}
      />,
    );

    // Assert
    expect(screen.getByTestId("dialog-title")).toHaveTextContent(
      "Create HTTP trigger",
    );
    expect(
      screen.getByRole("button", { name: "Create HTTP trigger" }),
    ).toBeEnabled();
  });

  it("shows a disabled pending submit button while creating", async () => {
    // Setup
    const useFormActionMock = await getCreateUseFormActionMock();
    useFormActionMock.mockReturnValue(
      createMockUseFormAction({ pending: true }),
    );

    // Act
    render(
      <HttpTriggerFormModal
        open={true}
        onOpenChange={vi.fn()}
        mode="create"
        editHttpTriggerId={null}
        pipelines={pipelines}
      />,
    );

    // Assert
    expect(screen.getByRole("button", { name: "Creating..." })).toBeDisabled();
  });

  it("shows the action error as an alert", async () => {
    // Setup
    const useFormActionMock = await getCreateUseFormActionMock();
    useFormActionMock.mockReturnValue(
      createMockUseFormAction({
        state: { status: false, message: "Pipeline not found" },
      }),
    );

    // Act
    render(
      <HttpTriggerFormModal
        open={true}
        onOpenChange={vi.fn()}
        mode="create"
        editHttpTriggerId={null}
        pipelines={pipelines}
      />,
    );

    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent("Pipeline not found");
  });

  it("closes the modal when Cancel is clicked", () => {
    // Setup
    const onOpenChange = vi.fn();
    render(
      <HttpTriggerFormModal
        open={true}
        onOpenChange={onOpenChange}
        mode="create"
        editHttpTriggerId={null}
        pipelines={pipelines}
      />,
    );

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Assert
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("prefills the fields with the trigger loaded for edit", async () => {
    // Setup
    const getHttpTriggerForEdit = await getHttpTriggerForEditMock();
    getHttpTriggerForEdit.mockResolvedValue({
      id: "trigger-1",
      name: "Webhook",
      description: null,
      pipelineId: "pipeline-1",
      enabled: true,
      method: "POST",
      tokenHint: "abcd",
    });

    // Act
    render(
      <HttpTriggerFormModal
        open={true}
        onOpenChange={vi.fn()}
        mode="edit"
        editHttpTriggerId="trigger-1"
        pipelines={pipelines}
      />,
    );

    // Assert
    const fields = await screen.findByTestId("http-trigger-form-fields");

    expect(fields).toHaveAttribute("data-default-name", "Webhook");
    expect(fields).toHaveAttribute("data-trigger-id", "trigger-1");
    expect(
      screen.getByRole("button", { name: "Save changes" }),
    ).toBeInTheDocument();
  });

  it("shows a not found message when the trigger is missing", async () => {
    // Setup
    const getHttpTriggerForEdit = await getHttpTriggerForEditMock();
    getHttpTriggerForEdit.mockResolvedValue(null);

    // Act
    render(
      <HttpTriggerFormModal
        open={true}
        onOpenChange={vi.fn()}
        mode="edit"
        editHttpTriggerId="missing"
        pipelines={pipelines}
      />,
    );

    // Assert
    await waitFor(() => {
      expect(screen.getByText("HTTP trigger not found.")).toBeInTheDocument();
    });
  });
});
