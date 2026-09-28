import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AddContractModal } from "./add-contract-modal";

const { searchParams } = vi.hoisted(() => ({
  searchParams: { current: "" },
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useSearchParams: () => new URLSearchParams(searchParams.current),
}));

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
    searchParams.current = "";
    vi.restoreAllMocks();
  });

  it("stays closed and renders no trigger of its own without a create request", () => {
    // Act
    render(<AddContractModal />);

    // Assert
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens from the create URL flag with a disabled submit until required fields are filled", () => {
    // Setup
    searchParams.current = "create=1";

    // Act
    render(<AddContractModal />);

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
    searchParams.current = "create=1";
    render(<AddContractModal />);

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
    render(<AddContractModal open onOpenChange={vi.fn()} />);

    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent("Name already used");
    expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
  });

  it("closes a controlled modal when Cancel is clicked", () => {
    // Setup
    const onOpenChange = vi.fn();
    render(<AddContractModal open onOpenChange={onOpenChange} />);

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Assert
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes and drops the create flag from the URL when Cancel is clicked", () => {
    // Setup
    searchParams.current = "create=1";
    window.history.replaceState(
      null,
      "",
      "/dashboard/agent-contracts?create=1&page=2",
    );
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    render(<AddContractModal />);

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Assert
    const nextUrl = String(replaceStateSpy.mock.calls.at(-1)?.[2]);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(nextUrl).toContain("/dashboard/agent-contracts?page=2");
    expect(nextUrl).not.toContain("create=1");
  });
});
