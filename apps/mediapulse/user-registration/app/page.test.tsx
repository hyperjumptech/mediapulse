import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Ticker } from "@/lib/tickers";

vi.mock("../public/tickers.json", () => ({
  default: [{ KodeEmiten: "BBCA", NamaEmiten: "Bank Central Asia Tbk" }],
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
    render(<Page />);

    // Assert
    expect(screen.getByTestId("registration-form")).toBeInTheDocument();
  });

  it("passes mapped tickers from the bundled JSON to the form", async () => {
    // Setup
    const Page = (await import("./page")).default;

    // Act
    render(<Page />);

    // Assert
    expect(screen.getByTestId("registration-form")).toHaveAttribute(
      "data-ticker-count",
      "1",
    );
  });
});
