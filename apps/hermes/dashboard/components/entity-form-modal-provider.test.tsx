import React from "react";
import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EntityFormModalProvider,
  useEntityFormModal,
} from "./entity-form-modal-provider";

const { searchParams } = vi.hoisted(() => ({
  searchParams: { current: "" },
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useSearchParams: () => new URLSearchParams(searchParams.current),
}));

afterEach(() => {
  searchParams.current = "";
});

const ModalStateProbe = () => {
  const { open, mode, editId, openCreate } = useEntityFormModal();

  return (
    <>
      <button type="button" onClick={openCreate}>
        Create from the empty state
      </button>
      <output
        data-testid="modal-state"
        data-open={open}
        data-mode={mode}
        data-edit-id={editId ?? "none"}
      />
    </>
  );
};

describe("EntityFormModalProvider", () => {
  it("starts with the shared modal closed", () => {
    // Act
    render(
      <EntityFormModalProvider>
        <ModalStateProbe />
      </EntityFormModalProvider>,
    );

    // Assert
    expect(screen.getByTestId("modal-state")).toHaveAttribute(
      "data-open",
      "false",
    );
  });

  it("opens the shared modal in create mode when a child asks for it", () => {
    // Setup
    render(
      <EntityFormModalProvider>
        <ModalStateProbe />
      </EntityFormModalProvider>,
    );

    // Act
    fireEvent.click(
      screen.getByRole("button", { name: "Create from the empty state" }),
    );

    // Assert
    const modalState = screen.getByTestId("modal-state");

    expect(modalState).toHaveAttribute("data-open", "true");
    expect(modalState).toHaveAttribute("data-mode", "create");
    expect(modalState).toHaveAttribute("data-edit-id", "none");
  });

  it("opens the shared modal in create mode when the URL asks for it", () => {
    // Setup
    searchParams.current = "create=1";

    // Act
    render(
      <EntityFormModalProvider>
        <ModalStateProbe />
      </EntityFormModalProvider>,
    );

    // Assert
    const modalState = screen.getByTestId("modal-state");

    expect(modalState).toHaveAttribute("data-open", "true");
    expect(modalState).toHaveAttribute("data-mode", "create");
  });

  it("throws when used outside the provider", () => {
    // Setup
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    // Act
    const renderOutsideProvider = () => renderHook(() => useEntityFormModal());

    // Assert
    expect(renderOutsideProvider).toThrow(
      "useEntityFormModal must be used inside an EntityFormModalProvider",
    );

    consoleErrorSpy.mockRestore();
  });
});
