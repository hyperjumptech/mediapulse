/** @vitest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

type MockFormActionState = {
  status: boolean;
  message?: string;
  data?: {
    id: string;
    label: string;
    readOnly: boolean;
    apiKeyPlaintext: string;
  };
} | null;

const MockFormWithAction = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <form className={className} data-testid="create-key-form">
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
  "@/app/dashboard/api-keys/actions/create/.generated/use-form-action",
  () => ({
    useFormAction: () => useFormActionMock(),
  }),
);

import { CreateApiKeyModal } from "./create-api-key-modal";

const openModal = () => {
  render(<CreateApiKeyModal trigger={<button type="button">Open</button>} />);
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
};

describe("CreateApiKeyModal", () => {
  afterEach(() => {
    useFormActionMock.mockReset();
  });

  it("renders the trigger while closed", () => {
    // Act
    render(<CreateApiKeyModal trigger={<button type="button">Open</button>} />);

    // Assert
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
    expect(screen.queryByTestId("create-key-form")).not.toBeInTheDocument();
  });

  it("shows the label field, read-only option and footer actions when opened", () => {
    // Act
    openModal();

    // Assert
    expect(screen.getByLabelText("Label")).toHaveAttribute(
      "name",
      "body.label",
    );
    expect(screen.getByLabelText("Read-only")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Create key" })).toHaveAttribute(
      "type",
      "submit",
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  });

  it("shows the action error as an alert", () => {
    // Setup
    useFormActionMock.mockReturnValue(
      createMockUseFormAction({ status: false, message: "Label is taken" }),
    );

    // Act
    openModal();

    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent("Label is taken");
  });

  it("closes the dialog when Cancel is clicked", () => {
    // Setup
    openModal();

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Assert
    expect(screen.queryByTestId("create-key-form")).not.toBeInTheDocument();
  });

  it("reveals the created key once with a copy warning", () => {
    // Setup
    useFormActionMock.mockReturnValue(
      createMockUseFormAction({
        status: true,
        data: {
          id: "key-1",
          label: "Cursor",
          readOnly: false,
          apiKeyPlaintext: "hmcp_secret_value",
        },
      }),
    );

    // Act
    openModal();

    // Assert
    expect(screen.getByText("hmcp_secret_value")).toBeInTheDocument();
    expect(
      screen.getByText("Copy this key now. It won't be shown again."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy to clipboard" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });
});
