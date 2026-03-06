import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const cookiesMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => cookiesMock(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("DashboardPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cookiesMock.mockReset();
  });

  it("renders dashboard heading when authenticated", async () => {
    // Setup
    cookiesMock.mockResolvedValue({
      get: () => ({ value: "true" }),
    });

    const DashboardPage = (await import("./page")).default;

    // Act
    const component = await DashboardPage({});
    render(component);

    // Assert
    expect(
      screen.getByRole("heading", { name: "Dashboard", level: 1 }),
    ).toBeInTheDocument();
  });

  it("renders description text when authenticated", async () => {
    // Setup
    cookiesMock.mockResolvedValue({
      get: () => ({ value: "true" }),
    });

    const DashboardPage = (await import("./page")).default;

    // Act
    const component = await DashboardPage({});
    render(component);

    // Assert
    expect(
      screen.getByText("Use the sidebar to manage pipelines and agents."),
    ).toBeInTheDocument();
  });

  it("applies correct styling to heading", async () => {
    // Setup
    cookiesMock.mockResolvedValue({
      get: () => ({ value: "true" }),
    });

    const DashboardPage = (await import("./page")).default;

    // Act
    const component = await DashboardPage({});
    render(component);

    // Assert
    const heading = screen.getByRole("heading", { name: "Dashboard" });
    expect(heading).toHaveClass("text-2xl");
    expect(heading).toHaveClass("font-semibold");
  });
});
