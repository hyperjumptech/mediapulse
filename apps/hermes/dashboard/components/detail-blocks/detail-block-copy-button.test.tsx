import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DetailBlockCopyButton } from "./detail-block-copy-button";

describe("DetailBlockCopyButton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders a small icon-only button named by its label", () => {
    render(
      <DetailBlockCopyButton value="abc-123" label="Copy newsletter id" />,
    );

    const button = screen.getByRole("button", { name: "Copy newsletter id" });

    expect(button).toHaveClass("size-7", "shrink-0");
    expect(button).toHaveAttribute("title", "Copy newsletter id");
    expect(button).toHaveTextContent("");
  });

  it("merges a custom className onto the button", () => {
    render(
      <DetailBlockCopyButton
        value="abc-123"
        label="Copy id"
        className="-my-1"
      />,
    );

    expect(screen.getByRole("button", { name: "Copy id" })).toHaveClass(
      "-my-1",
      "size-7",
    );
  });

  it("writes the value to the clipboard and announces the copy", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    render(<DetailBlockCopyButton value="abc-123" label="Copy id" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy id" }));
    const copiedButton = await screen.findByRole("button", { name: "Copied" });

    expect(writeText).toHaveBeenCalledWith("abc-123");
    expect(copiedButton).toBeInTheDocument();
  });

  it("keeps the copy label when the clipboard write rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    render(<DetailBlockCopyButton value="abc-123" label="Copy id" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy id" }));
    await Promise.resolve();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith("abc-123");
    expect(screen.queryByRole("button", { name: "Copied" })).toBeNull();
    expect(screen.getByRole("button", { name: "Copy id" })).toBeInTheDocument();
  });
});
