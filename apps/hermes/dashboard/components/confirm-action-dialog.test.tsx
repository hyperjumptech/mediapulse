import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmActionDialog } from "./confirm-action-dialog";

const TestForm = ({
  children,
}: {
  children: React.ReactNode;
  className?: string;
}) => <form data-testid="action-form">{children}</form>;

describe("ConfirmActionDialog", () => {
  it("renders the prompt with hidden fields and a destructive submit", () => {
    // Act
    render(
      <ConfirmActionDialog
        open
        onOpenChange={vi.fn()}
        title="Delete schedule?"
        description="This cannot be undone."
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        pending={false}
        FormWithAction={TestForm}
        hiddenFields={[{ name: "body.scheduleId", value: "schedule-1" }]}
      />,
    );

    // Assert
    expect(screen.getByText("Delete schedule?")).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
    expect(
      screen.getByTestId("action-form").querySelector("input[type=hidden]"),
    ).toHaveAttribute("value", "schedule-1");
    expect(screen.getByRole("button", { name: "Delete" })).toHaveAttribute(
      "type",
      "submit",
    );
  });

  it("disables both buttons and shows the pending label while submitting", () => {
    // Act
    render(
      <ConfirmActionDialog
        open
        onOpenChange={vi.fn()}
        title="Delete schedule?"
        description="This cannot be undone."
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        pending
        FormWithAction={TestForm}
        hiddenFields={[]}
      />,
    );

    // Assert
    expect(screen.getByRole("button", { name: /Deleting/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
