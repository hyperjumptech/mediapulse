import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExecutionDetailSkeleton } from "./execution-detail-skeleton";

describe("ExecutionDetailSkeleton", () => {
  it("announces loading and reserves one placeholder per stat card", () => {
    // Act
    const { container } = render(<ExecutionDetailSkeleton />);

    // Assert
    const statGrid = container.querySelector(".xl\\:grid-cols-6");

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(statGrid?.children).toHaveLength(6);
  });
});
