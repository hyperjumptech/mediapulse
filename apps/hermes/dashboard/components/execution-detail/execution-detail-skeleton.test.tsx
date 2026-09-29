import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExecutionDetailSkeleton } from "./execution-detail-skeleton";

describe("ExecutionDetailSkeleton", () => {
  it("announces loading and reserves one placeholder per stat card", () => {
    const { container } = render(<ExecutionDetailSkeleton />);
    const statGrid = container.querySelector(".\\@3xl\\/main\\:grid-cols-4");

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(statGrid?.children).toHaveLength(4);
  });
});
