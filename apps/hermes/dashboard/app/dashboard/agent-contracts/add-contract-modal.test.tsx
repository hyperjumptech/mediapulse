import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AddContractModal } from "./add-contract-modal";

type MockFormActionState = {
  status: boolean;
  message?: string;
  data?: { id: string };
} | null;

const MockFormWithAction = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <form className={className} data-testid="add-contract-form">
    {children}
  </form>
);

const createMockUseFormAction = (
  state: MockFormActionState = null,
  pending = false,
) => ({
  FormWithAction: MockFormWithAction,
  state,
  pending,
});

const useFormActionMock = vi.fn(() => createMockUseFormAction());

vi.mock(
  "@/app/dashboard/agent-contracts/actions/create/.generated/use-form-action",
  () => ({
    useFormAction: () => useFormActionMock(),
  }),
);

describe("AddContractModal", () => {
  afterEach(() => {
    useFormActionMock.mockReset();
  });

  it("opens from the default trigger with a disabled submit until required fields are filled", () => {
    // Setup
    render(<AddContractModal />);

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Add contract" }));

    // Assert
    expect(
      screen.getByRole("dialog", { name: "Add contract" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Version")).toHaveValue("1.0");
    expect(
      screen.getByRole("button", { name: "Create contract" }),
    ).toBeDisabled();
  });

  it("enables the submit once name and brief are filled", () => {
    // Setup
    render(<AddContractModal />);
    fireEvent.click(screen.getByRole("button", { name: "Add contract" }));

    // Act
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Weekly brief" },
    });
    fireEvent.change(screen.getByLabelText("Brief"), {
      target: { value: "Summarize the week." },
    });

    // Assert
    expect(
      screen.getByRole("button", { name: "Create contract" }),
    ).toBeEnabled();
  });

  it("shows the action error and the pending label in the footer", () => {
    // Setup
    useFormActionMock.mockReturnValue(
      createMockUseFormAction(
        { status: false, message: "Name already used" },
        true,
      ),
    );

    // Act
    render(<AddContractModal open onOpenChange={vi.fn()} trigger={null} />);

    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent("Name already used");
    expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
  });

  it("closes a controlled modal when Cancel is clicked", () => {
    // Setup
    const onOpenChange = vi.fn();
    render(
      <AddContractModal open onOpenChange={onOpenChange} trigger={null} />,
    );

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Assert
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
