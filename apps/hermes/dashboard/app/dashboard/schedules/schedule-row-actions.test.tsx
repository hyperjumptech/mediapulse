import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScheduleRowActions } from "./schedule-row-actions";

type DeleteActionState = { status: boolean; message?: string } | null;

const { useFormActionMock, toastErrorMock } = vi.hoisted(() => ({
  useFormActionMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock(
  "@/app/dashboard/schedules/actions/delete/.generated/use-form-action",
  () => ({
    useFormAction: () => useFormActionMock(),
  }),
);

vi.mock("sonner", () => ({
  toast: { error: toastErrorMock },
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
    name: "Actions for schedule Daily Run",
  });

  await act(async () => {
    fireEvent.keyDown(trigger, { key: "Enter" });
  });

  return screen.getByRole("menu");
};

const renderRowActions = (onEdit = vi.fn()) =>
  render(
    <ScheduleRowActions
      scheduleId="schedule-123"
      scheduleName="Daily Run"
      onEdit={onEdit}
    />,
  );

describe("ScheduleRowActions", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    mockDeleteAction();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useFormActionMock.mockReset();
    toastErrorMock.mockReset();
  });

  it("opens the edit modal for the schedule", async () => {
    // Setup
    const onEdit = vi.fn();
    renderRowActions(onEdit);
    const menu = await openActionsMenu();

    // Act
    await act(async () => {
      fireEvent.click(within(menu).getByRole("menuitem", { name: "Edit" }));
    });

    // Assert
    expect(onEdit).toHaveBeenCalledWith("schedule-123");
  });

  it("asks for confirmation before deleting", async () => {
    // Setup
    renderRowActions();
    const menu = await openActionsMenu();

    // Act
    await act(async () => {
      fireEvent.click(within(menu).getByRole("menuitem", { name: "Delete" }));
    });

    // Assert
    const dialog = screen.getByRole("alertdialog", {
      name: "Delete schedule?",
    });
    const hiddenInput = within(dialog)
      .getByTestId("delete-form")
      .querySelector('input[name="body.scheduleId"]');

    expect(dialog).toHaveTextContent("Daily Run");
    expect(hiddenInput).toHaveValue("schedule-123");
    expect(
      within(dialog).getByRole("button", { name: "Delete schedule" }),
    ).toHaveAttribute("type", "submit");
  });

  it("marks the delete item as destructive", async () => {
    // Setup
    renderRowActions();

    // Act
    const menu = await openActionsMenu();

    // Assert
    expect(
      within(menu).getByRole("menuitem", { name: "Delete" }),
    ).toHaveAttribute("data-variant", "destructive");
  });

  it("disables the delete item while a delete is pending", async () => {
    // Setup
    mockDeleteAction({ pending: true });
    renderRowActions();

    // Act
    const menu = await openActionsMenu();

    // Assert
    expect(
      within(menu).getByRole("menuitem", { name: "Delete" }),
    ).toHaveAttribute("data-disabled");
  });

  it("shows a toast when the delete fails", () => {
    // Setup
    mockDeleteAction({
      state: { status: false, message: "Schedule not found" },
    });

    // Act
    renderRowActions();

    // Assert
    expect(toastErrorMock).toHaveBeenCalledWith("Schedule not found");
  });

  it("does not toast after a successful delete", () => {
    // Setup
    mockDeleteAction({ state: { status: true } });

    // Act
    renderRowActions();

    // Assert
    expect(toastErrorMock).not.toHaveBeenCalled();
  });
});
