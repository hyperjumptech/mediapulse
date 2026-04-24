import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Ticker } from "@/lib/tickers";

const mockDbTickers = [
  { id: "1", symbol: "BBCA", name: "Bank Central Asia Tbk" },
];

vi.mock("@mediapulse/database", () => ({
  prisma: {
    ticker: {
      findMany: vi.fn().mockResolvedValue(mockDbTickers),
    },
  },
}));

vi.mock("@/components/registration-form", () => ({
  RegistrationForm: ({ tickers }: { tickers: Ticker[] }) => (
    <div data-testid="registration-form" data-ticker-count={tickers.length}>
      Registration Form
    </div>
  ),
}));

describe("Page", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the registration form", async () => {
    // Setup
    const Page = (await import("./page")).default;

    // Act
    const component = await Page();
    render(component);

    // Assert
    expect(screen.getByTestId("registration-form")).toBeInTheDocument();
  });

  it("passes mapped tickers from database to the form", async () => {
    // Setup
    const Page = (await import("./page")).default;

    // Act
    const component = await Page();
    render(component);

    // Assert
    expect(screen.getByTestId("registration-form")).toHaveAttribute(
      "data-ticker-count",
      "1",
    );
  });
});
