import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RelativeTime } from "./relative-time";

describe("RelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a compact relative label with a machine-readable datetime", () => {
    // Act
    render(<RelativeTime value="2026-09-28T11:57:00Z" />);

    // Assert
    const time = screen.getByText("3m ago");

    expect(time).toHaveAttribute("datetime", "2026-09-28T11:57:00.000Z");
    expect(time.getAttribute("title")).toBeTruthy();
  });

  it("describes future times", () => {
    // Act
    render(<RelativeTime value={new Date("2026-09-28T14:00:00Z")} />);

    // Assert
    expect(screen.getByText("in 2h")).toBeInTheDocument();
  });
});
