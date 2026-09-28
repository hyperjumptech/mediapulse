import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FormStatusSubmitButton, SubmitButton } from "./submit-button";

const useFormStatusMock = vi.fn(() => ({ pending: false }));

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();

  return {
    ...actual,
    useFormStatus: () => useFormStatusMock(),
  };
});

describe("SubmitButton", () => {
  it("renders an enabled submit button with its label", () => {
    // Act
    render(
      <SubmitButton pending={false} pendingLabel="Saving…">
        Save
      </SubmitButton>,
    );

    // Assert
    const button = screen.getByRole("button", { name: "Save" });

    expect(button).toHaveAttribute("type", "submit");
    expect(button).toBeEnabled();
  });

  it("shows a spinner and the pending label while pending", () => {
    // Act
    const { container } = render(
      <SubmitButton pending pendingLabel="Saving…">
        Save
      </SubmitButton>,
    );

    // Assert
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("stays disabled when the caller disables it", () => {
    // Act
    render(
      <SubmitButton pending={false} pendingLabel="Saving…" disabled>
        Save
      </SubmitButton>,
    );

    // Assert
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});

describe("FormStatusSubmitButton", () => {
  it("reads the pending state from the parent form", () => {
    // Setup
    useFormStatusMock.mockReturnValue({ pending: true });

    // Act
    render(
      <FormStatusSubmitButton pendingLabel="Creating…">
        Create
      </FormStatusSubmitButton>,
    );

    // Assert
    expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
  });
});
