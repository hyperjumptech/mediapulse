import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HttpTriggerRowActions } from "./http-trigger-row-actions";

type DeleteActionState = { status: boolean; message?: string } | null;

const { useFormActionMock, toastErrorMock, toastSuccessMock } = vi.hoisted(
  () => ({
    useFormActionMock: vi.fn(),
    toastErrorMock: vi.fn(),
    toastSuccessMock: vi.fn(),
  }),
);

vi.mock(
  "@/app/dashboard/http-triggers/actions/delete/.generated/use-form-action",
  () => ({
    useFormAction: () => useFormActionMock(),
  }),
);

vi.mock("sonner", () => ({
  toast: { error: toastErrorMock, success: toastSuccessMock },
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

const stubClipboard = (writeText: (text: string) => Promise<void>) => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
};

const openActionsMenu = async () => {
  const trigger = screen.getByRole("button", {
    name: "Actions for HTTP trigger Inbound webhook",
  });

  await act(async () => {
    fireEvent.keyDown(trigger, { key: "Enter" });
  });

  return screen.getByRole("menu");
};

const selectMenuItem = async (name: string) => {
  const menu = await openActionsMenu();

  await act(async () => {
    fireEvent.click(within(menu).getByRole("menuitem", { name }));
  });
};

const renderRowActions = (onEdit = vi.fn()) =>
  render(
    <HttpTriggerRowActions
      httpTriggerId="trigger-123"
      httpTriggerName="Inbound webhook"
      method="PUT"
      onEdit={onEdit}
    />,
  );

describe("HttpTriggerRowActions", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    mockDeleteAction();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useFormActionMock.mockReset();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
  });

  it("opens the edit modal for the trigger", async () => {
    // Setup
    const onEdit = vi.fn();
    renderRowActions(onEdit);

    // Act
    await selectMenuItem("Edit");

    // Assert
    expect(onEdit).toHaveBeenCalledWith("trigger-123");
  });

  it("copies an invoke cURL command and confirms with a toast", async () => {
    // Setup
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    renderRowActions();

    // Act
    await selectMenuItem("Copy cURL");

    // Assert
    expect(writeText).toHaveBeenCalledWith(
      `curl -X PUT "${window.location.origin}/api/http-triggers/trigger-123/invoke" -H "Authorization: Bearer <YOUR_TRIGGER_TOKEN>"`,
    );
    expect(toastSuccessMock).toHaveBeenCalledWith("cURL command copied");
  });

  it("reports a clipboard failure with an error toast", async () => {
    // Setup
    stubClipboard(() => Promise.reject(new Error("denied")));
    renderRowActions();

    // Act
    await selectMenuItem("Copy cURL");

    // Assert
    expect(toastErrorMock).toHaveBeenCalledWith(
      "Couldn't copy the cURL command",
    );
  });

  it("asks for confirmation before deleting", async () => {
    // Setup
    renderRowActions();

    // Act
    await selectMenuItem("Delete");

    // Assert
    const dialog = screen.getByRole("alertdialog", {
      name: "Delete HTTP trigger?",
    });
    const hiddenInput = within(dialog)
      .getByTestId("delete-form")
      .querySelector('input[name="body.httpTriggerId"]');

    expect(dialog).toHaveTextContent("Inbound webhook");
    expect(hiddenInput).toHaveValue("trigger-123");
    expect(
      within(dialog).getByRole("button", { name: "Delete HTTP trigger" }),
    ).toHaveAttribute("type", "submit");
  });

  it("shows a toast when the delete fails", () => {
    // Setup
    mockDeleteAction({ state: { status: false, message: "Not found" } });

    // Act
    renderRowActions();

    // Assert
    expect(toastErrorMock).toHaveBeenCalledWith("Not found");
  });

  it("falls back to a generic message when the failure has no message", () => {
    // Setup
    mockDeleteAction({ state: { status: false } });

    // Act
    renderRowActions();

    // Assert
    expect(toastErrorMock).toHaveBeenCalledWith("Delete failed");
  });
});
