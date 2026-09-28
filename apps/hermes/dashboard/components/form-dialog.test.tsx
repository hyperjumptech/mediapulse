import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Dialog } from "@workspace/ui/components/dialog";

import {
  FormDialogBody,
  FormDialogCancelButton,
  FormDialogContent,
  FormDialogFooter,
  FormDialogHeader,
  FormDialogMessage,
  formDialogFormClassName,
} from "./form-dialog";

describe("FormDialogContent", () => {
  it("renders a titled dialog capped at the default width", () => {
    // Act
    render(
      <Dialog open>
        <FormDialogContent>
          <FormDialogHeader title="Create schedule" />
        </FormDialogContent>
      </Dialog>,
    );

    // Assert
    const dialog = screen.getByRole("dialog", { name: "Create schedule" });

    expect(dialog).toHaveClass("sm:max-w-lg");
    expect(dialog).not.toHaveAttribute("aria-describedby");
  });

  it("widens the dialog for long editors", () => {
    // Act
    render(
      <Dialog open>
        <FormDialogContent size="wide">
          <FormDialogHeader title="Add contract" />
        </FormDialogContent>
      </Dialog>,
    );

    // Assert
    expect(screen.getByRole("dialog", { name: "Add contract" })).toHaveClass(
      "sm:max-w-2xl",
    );
  });
});

describe("FormDialogBody", () => {
  it("renders a scrollable body with the given children", () => {
    // Act
    render(<FormDialogBody>Fields</FormDialogBody>);

    // Assert
    expect(screen.getByText("Fields")).toHaveClass("overflow-y-auto");
  });
});

describe("FormDialogFooter", () => {
  it("renders the actions without an alert when there is no error", () => {
    // Act
    render(
      <FormDialogFooter>
        <button type="submit">Save</button>
      </FormDialogFooter>,
    );

    // Assert
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders the error message as an alert above the actions", () => {
    // Act
    render(
      <FormDialogFooter errorMessage="Name is required">
        <button type="submit">Save</button>
      </FormDialogFooter>,
    );

    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent("Name is required");
  });
});

describe("FormDialogCancelButton", () => {
  it("calls onCancel when clicked", () => {
    // Setup
    const onCancel = vi.fn();
    render(<FormDialogCancelButton onCancel={onCancel} />);

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Assert
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("can be disabled while the form is pending", () => {
    // Act
    render(<FormDialogCancelButton onCancel={vi.fn()} disabled />);

    // Assert
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});

describe("FormDialogMessage", () => {
  it("renders a plain message", () => {
    // Act
    const { container } = render(
      <FormDialogMessage>Schedule not found.</FormDialogMessage>,
    );

    // Assert
    expect(screen.getByText("Schedule not found.")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("renders a spinner next to the message while loading", () => {
    // Act
    const { container } = render(
      <FormDialogMessage loading>Loading schedule…</FormDialogMessage>,
    );

    // Assert
    expect(screen.getByText("Loading schedule…")).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveClass("animate-spin");
  });
});

describe("formDialogFormClassName", () => {
  it("lets the form fill the dialog so the footer stays pinned", () => {
    // Assert
    expect(formDialogFormClassName).toContain("flex-1");
    expect(formDialogFormClassName).toContain("min-h-0");
  });
});
