import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Ticker } from "@/lib/tickers";

vi.mock("@/lib/load-registration-tickers", () => ({
  loadRegistrationTickers: vi.fn(async () => [
    { KodeEmiten: "BBCA", NamaEmiten: "Bank Central Asia Tbk" },
  ]),
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
    const Page = (await import("./page")).default;

    const ui = await Page();
    render(ui);

    expect(screen.getByTestId("registration-form")).toBeInTheDocument();
  });

  it("passes tickers loaded for registration to the form", async () => {
    const Page = (await import("./page")).default;

    const ui = await Page();
    render(ui);

    expect(screen.getByTestId("registration-form")).toHaveAttribute(
      "data-ticker-count",
      "1",
    );
  });

  it("renders Hyperjump product attribution with an external link", async () => {
    const Page = (await import("./page")).default;

    const ui = await Page();
    render(ui);

    const link = screen.getByRole("link", { name: /^Hyperjump$/i });
    expect(link).toHaveAttribute("href", "https://hyperjump.tech");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
