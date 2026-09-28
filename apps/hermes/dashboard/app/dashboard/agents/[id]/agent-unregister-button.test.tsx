import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { useFormActionMock, routerPushMock, toastErrorMock } = vi.hoisted(
  () => ({
    useFormActionMock: vi.fn(),
    routerPushMock: vi.fn(),
    toastErrorMock: vi.fn(),
  }),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock }),
}));

vi.mock("sonner", () => ({
  toast: { error: toastErrorMock },
}));

vi.mock(
  "@/app/dashboard/agents/actions/unregister/.generated/use-form-action",
  () => ({
    useFormAction: useFormActionMock,
  }),
);

import { AgentUnregisterButton } from "./agent-unregister-button";

type FormActionState = { status: boolean; message?: string } | null;

const UnregisterForm = ({ children }: { children: React.ReactNode }) => (
  <form data-testid="unregister-form">{children}</form>
);

const mockFormAction = ({
  state = null,
  pending = false,
}: {
  state?: FormActionState;
  pending?: boolean;
} = {}) => {
  useFormActionMock.mockReturnValue({
    FormWithAction: UnregisterForm,
    state,
    pending,
  });
};

describe("AgentUnregisterButton", () => {
  afterEach(() => {
    useFormActionMock.mockReset();
    routerPushMock.mockReset();
    toastErrorMock.mockReset();
  });

  it("opens a confirmation dialog instead of using the native confirm", () => {
    // Setup
    mockFormAction();
    const confirmSpy = vi.spyOn(window, "confirm");
    render(
      <AgentUnregisterButton agentId="agent-123" agentLabel="summarizer@2.0" />,
    );

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Unregister agent" }));

    // Assert
    const dialog = screen.getByRole("alertdialog");
    const hiddenInput = screen
      .getByTestId("unregister-form")
      .querySelector('input[name="body.id"]');

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(dialog).toHaveTextContent("Unregister agent?");
    expect(dialog).toHaveTextContent("summarizer@2.0");
    expect(hiddenInput).toHaveValue("agent-123");

    confirmSpy.mockRestore();
  });

  it("shows the pending label and disables the trigger while unregistering", () => {
    // Setup
    mockFormAction({ pending: true });

    // Act
    render(
      <AgentUnregisterButton agentId="agent-123" agentLabel="summarizer@2.0" />,
    );

    // Assert
    expect(
      screen.getByRole("button", { name: "Unregistering…" }),
    ).toBeDisabled();
  });

  it("returns to the agents list after unregistering", () => {
    // Setup
    mockFormAction({ state: { status: true } });

    // Act
    render(
      <AgentUnregisterButton agentId="agent-123" agentLabel="summarizer@2.0" />,
    );

    // Assert
    expect(routerPushMock).toHaveBeenCalledWith("/dashboard/agents");
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("stays on the page and toasts when unregistering fails", () => {
    // Setup
    mockFormAction({ state: { status: false, message: "Agent not found" } });

    // Act
    render(
      <AgentUnregisterButton agentId="agent-123" agentLabel="summarizer@2.0" />,
    );

    // Assert
    expect(routerPushMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith("Agent not found");
  });
});
