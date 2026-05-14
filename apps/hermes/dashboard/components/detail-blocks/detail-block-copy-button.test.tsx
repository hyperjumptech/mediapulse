/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DetailBlockCopyButton } from "./detail-block-copy-button";

describe("DetailBlockCopyButton", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the Copy label and the accessible aria-label", () => {
    render(
      <DetailBlockCopyButton value="abc-123" label="Copy newsletter id" />,
    );

    const button = screen.getByRole("button", { name: "Copy newsletter id" });
    expect(button).toBeInTheDocument();
    expect(screen.getByText("Copy")).toBeInTheDocument();
  });

  it("writes the value to the clipboard and shows the Copied confirmation", async () => {
    // Setup
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    // Act
    render(<DetailBlockCopyButton value="abc-123" label="Copy id" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy id" }));
    await screen.findByText("Copied");

    // Assert
    expect(writeText).toHaveBeenCalledWith("abc-123");
    expect(screen.getByText("Copied")).toBeInTheDocument();
  });

  it("keeps showing Copy when the clipboard write rejects", async () => {
    // Setup
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    // Act
    render(<DetailBlockCopyButton value="abc-123" label="Copy id" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy id" }));
    await Promise.resolve();
    await Promise.resolve();

    // Assert
    expect(writeText).toHaveBeenCalledWith("abc-123");
    expect(screen.queryByText("Copied")).toBeNull();
    expect(screen.getByText("Copy")).toBeInTheDocument();
  });
});
