import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PipelineRowActions } from "./pipeline-row-actions";

type DeleteActionState = { status: boolean; message?: string } | null;

const { useFormActionMock, toastErrorMock } = vi.hoisted(() => ({
  useFormActionMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock(
  "@/app/dashboard/pipelines/actions/delete/.generated/use-form-action",
  () => ({
    useFormAction: () => useFormActionMock(),
  }),
);

vi.mock("sonner", () => ({
  toast: { error: toastErrorMock },
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const DeleteForm = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <form data-testid="delete-form" className={className}>
    {children}
  </form>
);

const mockDeleteAction = ({
  state = null,
  pending = false,
}: { state?: DeleteActionState; pending?: boolean } = {}) => {
  useFormActionMock.mockReturnValue({
    FormWithAction: DeleteForm,
    state,
    pending,
  });
};

const openActionsMenu = async () => {
  const trigger = screen.getByRole("button", {
    name: "Actions for pipeline Newsletter",
  });

  await act(async () => {
    fireEvent.keyDown(trigger, { key: "Enter" });
  });

  return screen.getByRole("menu");
};

describe("PipelineRowActions", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    mockDeleteAction();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useFormActionMock.mockReset();
    toastErrorMock.mockReset();
  });

  it("opens the edit modal when a handler is provided", async () => {
    // Setup
    const onEdit = vi.fn();
    render(
      <PipelineRowActions
        pipelineId="pipeline-123"
        pipelineName="Newsletter"
        onEdit={onEdit}
      />,
    );
    const menu = await openActionsMenu();

    // Act
    await act(async () => {
      fireEvent.click(within(menu).getByRole("menuitem", { name: "Edit" }));
    });

    // Assert
    expect(onEdit).toHaveBeenCalledWith("pipeline-123");
  });

  it("links Edit to the pipeline editor without a handler", async () => {
    // Setup
    render(
      <PipelineRowActions
        pipelineId="pipeline-123"
        pipelineName="Newsletter"
      />,
    );

    // Act
    const menu = await openActionsMenu();

    // Assert
    expect(
      within(menu).getByRole("menuitem", { name: "Edit" }),
    ).toHaveAttribute("href", "/dashboard/pipelines/pipeline-123");
  });

  it("warns that deleting removes dependent schedules and triggers", async () => {
    // Setup
    render(
      <PipelineRowActions
        pipelineId="pipeline-123"
        pipelineName="Newsletter"
      />,
    );
    const menu = await openActionsMenu();

    // Act
    await act(async () => {
      fireEvent.click(within(menu).getByRole("menuitem", { name: "Delete" }));
    });

    // Assert
    const dialog = screen.getByRole("alertdialog", {
      name: "Delete pipeline?",
    });
    const hiddenInput = within(dialog)
      .getByTestId("delete-form")
      .querySelector('input[name="body.pipelineId"]');

    expect(dialog).toHaveTextContent("Newsletter");
    expect(dialog).toHaveTextContent(
      "every schedule and HTTP trigger that uses it",
    );
    expect(hiddenInput).toHaveValue("pipeline-123");
    expect(
      within(dialog).getByRole("button", { name: "Delete pipeline" }),
    ).toHaveAttribute("type", "submit");
  });

  it("disables the delete item while a delete is pending", async () => {
    // Setup
    mockDeleteAction({ pending: true });
    render(
      <PipelineRowActions
        pipelineId="pipeline-123"
        pipelineName="Newsletter"
      />,
    );

    // Act
    const menu = await openActionsMenu();

    // Assert
    expect(
      within(menu).getByRole("menuitem", { name: "Delete" }),
    ).toHaveAttribute("data-disabled");
  });

  it("shows a toast when the delete fails", () => {
    // Setup
    mockDeleteAction({ state: { status: false, message: "Pipeline in use" } });

    // Act
    render(
      <PipelineRowActions
        pipelineId="pipeline-123"
        pipelineName="Newsletter"
      />,
    );

    // Assert
    expect(toastErrorMock).toHaveBeenCalledWith("Pipeline in use");
  });
});
