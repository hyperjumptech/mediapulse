import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const copyMock = vi.fn();

vi.mock("@/hooks/use-copy-to-clipboard", () => ({
  useCopyToClipboard: () => ({ copied: false, copy: copyMock }),
}));

import { CopyableId } from "./copyable-id";

describe("CopyableId", () => {
  it("shows the id and copies it", () => {
    // Setup
    render(<CopyableId value="exec-123" />);

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Copy ID" }));

    // Assert
    expect(screen.getByText("exec-123")).toBeInTheDocument();
    expect(copyMock).toHaveBeenCalledWith("exec-123");
  });
});
