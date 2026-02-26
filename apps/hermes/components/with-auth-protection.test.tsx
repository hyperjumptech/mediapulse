import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withAuthProtection } from "./with-auth-protection";

const cookiesMock = vi.fn();
const redirectMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => cookiesMock(),
}));

vi.mock("next/navigation", () => ({
  redirect: (...args: [string]) => redirectMock(...args),
}));

describe("withAuthProtection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cookiesMock.mockReset();
    redirectMock.mockReset();
  });

  it("redirects to login when auth cookie is missing", async () => {
    // Setup
    cookiesMock.mockResolvedValue({
      get: () => undefined,
    });
    redirectMock.mockImplementation(() => {
      throw new Error("REDIRECT");
    });

    const ProtectedPage = withAuthProtection(() => <div>Dashboard</div>);

    // Act & Assert
    await expect(ProtectedPage({})).rejects.toThrow("REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("renders wrapped component when auth cookie exists", async () => {
    // Setup
    cookiesMock.mockResolvedValue({
      get: () => ({ value: "true" }),
    });
    const ProtectedPage = withAuthProtection(() => <div>Dashboard</div>);

    // Act
    const component = await ProtectedPage({});
    render(component);

    // Assert
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
