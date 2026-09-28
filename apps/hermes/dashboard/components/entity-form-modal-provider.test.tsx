import React from "react";
import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  EntityFormModalCreateButton,
  EntityFormModalProvider,
  useEntityFormModal,
} from "./entity-form-modal-provider";

const ModalStateProbe = () => {
  const { open, mode, editId } = useEntityFormModal();

  return (
    <output
      data-testid="modal-state"
      data-open={open}
      data-mode={mode}
      data-edit-id={editId ?? "none"}
    />
  );
};

describe("EntityFormModalProvider", () => {
  it("opens the shared modal in create mode from the header button", () => {
    // Setup
    render(
      <EntityFormModalProvider>
        <EntityFormModalCreateButton label="New schedule" />
        <ModalStateProbe />
      </EntityFormModalProvider>,
    );

    // Act
    fireEvent.click(screen.getByRole("button", { name: "New schedule" }));

    // Assert
    const modalState = screen.getByTestId("modal-state");

    expect(modalState).toHaveAttribute("data-open", "true");
    expect(modalState).toHaveAttribute("data-mode", "create");
    expect(modalState).toHaveAttribute("data-edit-id", "none");
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
