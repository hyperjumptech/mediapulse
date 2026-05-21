/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DashboardPageCustomAction } from "@hermes/domain-contract";

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

describe("DomainTableDangerConfirmButton", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the action label as a destructive button", () => {
    render(
      <DomainTableDangerConfirmButton
        action={action}
        serverAction={async () => ({ status: "idle" })}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Reset all entities" }),
    ).toBeInTheDocument();
  });

  it("does not submit when the user cancels confirm", () => {
    const serverAction = vi.fn();
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));

    render(
      <DomainTableDangerConfirmButton
        action={action}
        serverAction={serverAction}
      />,
    );

    fireEvent.submit(
      screen
        .getByRole("button", { name: "Reset all entities" })
        .closest("form")!,
    );

    expect(serverAction).not.toHaveBeenCalled();
  });
});
