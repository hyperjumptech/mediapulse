import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DashboardError from "./error";

describe("DashboardError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the server reference when the error has a digest", () => {
    // Setup
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const serverError = Object.assign(new Error("hidden"), {
      digest: "abc123",
    });

    // Act
    render(<DashboardError error={serverError} unstable_retry={vi.fn()} />);

    // Assert
    expect(
      screen.getByText(
        "Something went wrong on the server (reference abc123).",
      ),
    ).toBeInTheDocument();
  });

  it("shows the message for client errors and retries on click", () => {
    // Setup
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const retry = vi.fn();

    // Act
    render(<DashboardError error={new Error("Boom")} unstable_retry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    // Assert
    expect(screen.getByText("Boom")).toBeInTheDocument();
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
