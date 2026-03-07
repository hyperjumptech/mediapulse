import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorLogModal } from "./error-log-modal";

vi.mock("@workspace/ui/components/dialog", () => ({
  Dialog: ({ children, open }: React.PropsWithChildren<{ open?: boolean }>) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: React.PropsWithChildren) => (
    <header>{children}</header>
  ),
  DialogTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
}));

describe("ErrorLogModal", () => {
  it("renders when open", () => {
    render(
      <ErrorLogModal
        open={true}
        onOpenChange={vi.fn()}
        errors={[{ message: "Error", timestamp: "2025-01-15" }]}
      />,
    );
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Error log" }),
    ).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(<ErrorLogModal open={false} onOpenChange={vi.fn()} errors={null} />);
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("renders array of message/timestamp as list", () => {
    const errors = [
      { message: "First error", timestamp: "2025-01-15T10:00:00Z" },
      { message: "Second error", timestamp: "2025-01-15T10:01:00Z" },
    ];
    render(
      <ErrorLogModal open={true} onOpenChange={vi.fn()} errors={errors} />,
    );
    expect(screen.getByText("First error")).toBeInTheDocument();
    expect(screen.getByText("Second error")).toBeInTheDocument();
  });

  it("renders no error details when errors is null", () => {
    render(<ErrorLogModal open={true} onOpenChange={vi.fn()} errors={null} />);
    expect(screen.getByText("No error details.")).toBeInTheDocument();
  });

  it("renders raw JSON for non-array errors", () => {
    const errors = { code: "ERR_001", detail: "Something went wrong" };
    render(
      <ErrorLogModal open={true} onOpenChange={vi.fn()} errors={errors} />,
    );
    expect(screen.getByText(/ERR_001/)).toBeInTheDocument();
  });
});
