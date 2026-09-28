import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AddAdminModal } from "./add-admin-modal";

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
  <form className={className} data-testid="add-admin-form">
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
  "@/app/dashboard/admins/actions/create/.generated/use-form-action",
  () => ({
    useFormAction: () => useFormActionMock(),
  }),
);

const openModal = () => {
  searchParams.current = "create=1";
  render(<AddAdminModal />);
};

describe("AddAdminModal", () => {
  afterEach(() => {
    useFormActionMock.mockReset();
    searchParams.current = "";
    vi.restoreAllMocks();
  });

  it("stays closed and renders no trigger of its own without a create request", () => {
    // Act
    render(<AddAdminModal />);

    // Assert
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens from the create URL flag", () => {
    // Act
    openModal();

    // Assert
    expect(
      screen.getByRole("dialog", { name: "Add admin" }),
    ).toBeInTheDocument();
  });

  it("shows the name, email and password fields with footer actions", () => {
    // Act
    openModal();

    // Assert
    expect(screen.getByLabelText("Name")).toHaveAttribute("name", "body.name");
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "name",
      "body.email",
    );
    expect(screen.getByLabelText("Initial password")).toHaveAttribute(
      "name",
      "body.password",
    );
    expect(
      screen.getByRole("button", { name: "Create admin" }),
    ).toHaveAttribute("type", "submit");
  });

  it("shows the action error and pending label", () => {
    // Setup
    useFormActionMock.mockReturnValue(
      createMockUseFormAction(
        { status: false, message: "Email already used" },
        true,
      ),
    );

    // Act
    openModal();

    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent("Email already used");
    expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
  });

  it("closes and drops the create flag from the URL when Cancel is clicked", () => {
    // Setup
    window.history.replaceState(null, "", "/dashboard/admins?create=1");
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    openModal();

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Assert
    const nextUrl = String(replaceStateSpy.mock.calls.at(-1)?.[2]);

    expect(screen.queryByTestId("add-admin-form")).not.toBeInTheDocument();
    expect(nextUrl).toMatch(/\/dashboard\/admins$/);
  });

  it("closes after a successful create", () => {
    // Setup
    useFormActionMock.mockReturnValue(
      createMockUseFormAction({ status: true, data: { id: "admin-1" } }),
    );

    // Act
    openModal();

    // Assert
    expect(screen.queryByTestId("add-admin-form")).not.toBeInTheDocument();
  });
});
