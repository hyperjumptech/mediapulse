/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DashboardPageCustomAction } from "@hermes/domain-contract";

import type { DomainTableDangerConfirmState } from "@/lib/domain-dashboard";

const { toastSuccessMock } = vi.hoisted(() => ({
  toastSuccessMock: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock },
}));

import { DomainTableDangerConfirmButton } from "./domain-table-danger-confirm-button";

const action: DashboardPageCustomAction = {
  id: "reset-all",
  label: "Reset all entities",
  ui: "danger-confirm",
  method: "POST",
  path: "/reset-all",
  confirmMessage: "Delete all?",
  confirmToken: "DELETE_ALL_ENTITIES",
};

type DangerConfirmServerAction = (
  state: DomainTableDangerConfirmState,
  formData: FormData,
) => Promise<DomainTableDangerConfirmState>;

const openConfirmation = () => {
  fireEvent.click(screen.getByRole("button", { name: "Reset all entities" }));

  return screen.getByRole("alertdialog");
};

const confirmButtonIn = (dialog: HTMLElement) =>
  Array.from(dialog.querySelectorAll("button")).find(
    (button) => button.getAttribute("type") === "submit",
  );

describe("DomainTableDangerConfirmButton", () => {
  afterEach(() => {
    toastSuccessMock.mockReset();
  });

  it("renders the action label as a destructive button without submitting", () => {
    // Setup
    const serverAction = vi.fn<DangerConfirmServerAction>();

    // Act
    render(
      <DomainTableDangerConfirmButton
        action={action}
        serverAction={serverAction}
      />,
    );

    // Assert
    expect(
      screen.getByRole("button", { name: "Reset all entities" }),
    ).toHaveAttribute("type", "button");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(serverAction).not.toHaveBeenCalled();
  });

  it("shows the manifest confirm message before running the action", () => {
    // Setup
    render(
      <DomainTableDangerConfirmButton
        action={action}
        serverAction={vi.fn<DangerConfirmServerAction>()}
      />,
    );

    // Act
    const dialog = openConfirmation();

    // Assert
    expect(dialog).toHaveTextContent("Reset all entities?");
    expect(dialog).toHaveTextContent("Delete all?");
  });

  it("falls back to a generic confirm message", () => {
    // Setup
    const actionWithoutMessage = { ...action, confirmMessage: undefined };
    render(
      <DomainTableDangerConfirmButton
        action={actionWithoutMessage}
        serverAction={vi.fn<DangerConfirmServerAction>()}
      />,
    );

    // Act
    const dialog = openConfirmation();

    // Assert
    expect(dialog).toHaveTextContent(
      "Are you sure? This action cannot be undone.",
    );
  });

  it("does not submit when the user cancels", () => {
    // Setup
    const serverAction = vi.fn<DangerConfirmServerAction>();
    render(
      <DomainTableDangerConfirmButton
        action={action}
        serverAction={serverAction}
      />,
    );
    openConfirmation();

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Assert
    expect(serverAction).not.toHaveBeenCalled();
  });

  it("posts the action id, toasts the result, and closes on success", async () => {
    // Setup
    const serverAction = vi.fn<DangerConfirmServerAction>(async () => ({
      status: "success",
      deleted: 3,
    }));
    render(
      <DomainTableDangerConfirmButton
        action={action}
        serverAction={serverAction}
      />,
    );
    const dialog = openConfirmation();

    // Act
    fireEvent.click(confirmButtonIn(dialog) as HTMLButtonElement);

    // Assert
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Deleted 3 rows.");
    });

    const submittedFormData = serverAction.mock.calls[0]?.[1];

    expect(submittedFormData?.get("__actionId")).toBe("reset-all");
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });

  it("keeps the dialog open and shows the server error on failure", async () => {
    // Setup
    const serverAction = vi.fn<DangerConfirmServerAction>(async () => ({
      status: "error",
      message: "Domain API unavailable",
    }));
    render(
      <DomainTableDangerConfirmButton
        action={action}
        serverAction={serverAction}
      />,
    );
    const dialog = openConfirmation();

    // Act
    fireEvent.click(confirmButtonIn(dialog) as HTMLButtonElement);

    // Assert
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Domain API unavailable",
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });
});
