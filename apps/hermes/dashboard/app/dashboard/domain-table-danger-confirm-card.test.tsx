/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DashboardPageCustomAction } from "@hermes/domain-contract";

import { DomainTableDangerConfirmCard } from "./domain-table-danger-confirm-card";

const action: DashboardPageCustomAction = {
  id: "reset-all",
  label: "Reset all relations",
  description: "Deletes every edge.",
  ui: "danger-confirm",
  method: "POST",
  path: "/reset-all",
  confirmMessage: "Delete all?",
  confirmToken: "DELETE_ALL_ENTITY_RELATIONS",
};

describe("DomainTableDangerConfirmCard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the action label and description", () => {
    // Act
    render(
      <DomainTableDangerConfirmCard
        action={action}
        serverAction={async () => ({ status: "idle" })}
      />,
    );

    // Assert
    expect(
      screen.getByRole("heading", { name: "Reset all relations" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Deletes every edge.")).toBeInTheDocument();
  });

  it("does not submit when the user cancels confirm", () => {
    // Setup
    const serverAction = vi.fn();
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));

    render(
      <DomainTableDangerConfirmCard
        action={action}
        serverAction={serverAction}
      />,
    );

    // Act
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Reset all relations" })
        .closest("form")!,
    );

    // Assert
    expect(serverAction).not.toHaveBeenCalled();
  });
});
