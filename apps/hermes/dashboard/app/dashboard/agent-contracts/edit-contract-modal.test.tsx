import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentContractRow } from "./agent-contract-row-actions";
import { EditContractModal } from "./edit-contract-modal";

type MockFormActionState = { status: boolean; message?: string } | null;

const MockFormWithAction = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <form className={className} data-testid="edit-contract-form">
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
  "@/app/dashboard/agent-contracts/actions/update/.generated/use-form-action",
  () => ({
    useFormAction: () => useFormActionMock(),
  }),
);

const contract: AgentContractRow = {
  id: "contract-1",
  name: "Weekly brief",
  description: null,
  brief: "Summarize the week.",
  version: "1.0",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  createdBy: null,
};

describe("EditContractModal", () => {
  afterEach(() => {
    useFormActionMock.mockReset();
  });

  it("renders nothing without a contract", () => {
    // Act
    const { container } = render(
      <EditContractModal contract={null} open onOpenChange={vi.fn()} />,
    );

    // Assert
    expect(container).toBeEmptyDOMElement();
  });

  it("prefills the fields and posts the contract id", () => {
    // Act
    render(
      <EditContractModal contract={contract} open onOpenChange={vi.fn()} />,
    );

    // Assert
    const formData = new FormData(
      screen.getByTestId("edit-contract-form") as HTMLFormElement,
    );

    expect(
      screen.getByRole("dialog", { name: "Edit contract: Weekly brief" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Weekly brief");
    expect(formData.get("body.id")).toBe("contract-1");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("shows the action error and pending label", () => {
    // Setup
    useFormActionMock.mockReturnValue(
      createMockUseFormAction(
        { status: false, message: "Version taken" },
        true,
      ),
    );

    // Act
    render(
      <EditContractModal contract={contract} open onOpenChange={vi.fn()} />,
    );

    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent("Version taken");
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });

  it("closes when Cancel is clicked", () => {
    // Setup
    const onOpenChange = vi.fn();
    render(
      <EditContractModal
        contract={contract}
        open
        onOpenChange={onOpenChange}
      />,
    );

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Assert
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
