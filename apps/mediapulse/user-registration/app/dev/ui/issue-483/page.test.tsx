/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notFound } from "next/navigation";

const envState: {
  NODE_ENV: string | undefined;
  AGENT_DATA_API_URL: string;
  PORT: number | undefined;
  NEXT_PUBLIC_REGISTRATION_EMAIL: string;
} = {
  NODE_ENV: "development",
  AGENT_DATA_API_URL: "http://localhost:8081",
  PORT: undefined,
  NEXT_PUBLIC_REGISTRATION_EMAIL: "registration@test.example",
};

vi.mock("@mediapulse/env/app-user-registration", () => ({
  get env() {
    return envState;
  },
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

describe("DevUiIssue483Page", () => {
  beforeEach(() => {
    envState.NODE_ENV = "development";
    vi.mocked(notFound).mockClear();
    vi.mocked(notFound).mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("renders the registration form and Hyperjump attribution when NODE_ENV is development", async () => {
    const Page = (await import("./page")).default;

    // Act
    const ui = Page();
    render(ui);

    // Assert
    expect(screen.getByLabelText(/Your name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Stock ticker/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Open email app to subscribe/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /^Hyperjump$/i }),
    ).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("calls notFound when NODE_ENV is not development", async () => {
    envState.NODE_ENV = "test";
    const Page = (await import("./page")).default;

    // Act & Assert
    expect(() => Page()).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
