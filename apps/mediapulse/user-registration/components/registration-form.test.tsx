import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RegistrationForm } from "./registration-form";
import type { Ticker } from "@/lib/tickers";

vi.mock("@mediapulse/env/app-user-registration", () => ({
  env: { NEXT_PUBLIC_REGISTRATION_EMAIL: "registration@test.example" },
}));

const sampleTickers: Ticker[] = [
  { KodeEmiten: "AADI", NamaEmiten: "PT Adaro Andalan Indonesia Tbk" },
  { KodeEmiten: "BBCA", NamaEmiten: "Bank Central Asia Tbk" },
  { KodeEmiten: "TLKM", NamaEmiten: "Telkom Indonesia Tbk" },
];

describe("RegistrationForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the email and ticker search inputs", () => {
    // Act
    render(<RegistrationForm tickers={sampleTickers} openMailto={vi.fn()} />);

    // Assert
    expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Stock ticker/i)).toBeInTheDocument();
  });

  it("renders the subscribe button as disabled when no ticker is selected", () => {
    // Act
    render(<RegistrationForm tickers={sampleTickers} openMailto={vi.fn()} />);

    // Assert
    expect(screen.getByRole("button", { name: /Subscribe/i })).toBeDisabled();
  });

  it("shows ticker dropdown when search input is focused", async () => {
    // Setup
    const user = userEvent.setup();
    render(<RegistrationForm tickers={sampleTickers} openMailto={vi.fn()} />);

    // Act
    await user.click(screen.getByLabelText(/Stock ticker/i));

    // Assert
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("calls openMailto with formed URL when submitted and shows success", async () => {
    // Setup
    const user = userEvent.setup();
    const mockOpenMailto = vi.fn();
    render(
      <RegistrationForm tickers={sampleTickers} openMailto={mockOpenMailto} />,
    );

    // Act
    await user.type(
      screen.getByLabelText(/Email address/i),
      "test@example.com",
    );
    await user.type(screen.getByLabelText(/Full name/i), "John Doe");

    // Select Ticker
    await user.click(screen.getByLabelText(/Stock ticker/i));
    await user.click(screen.getByText(/Bank Central Asia Tbk/i));

    // Submit
    const subscribeBtn = screen.getByRole("button", { name: /Subscribe/i });
    expect(subscribeBtn).not.toBeDisabled();
    await user.click(subscribeBtn);

    // Assert mailto was called
    expect(mockOpenMailto).toHaveBeenCalledTimes(1);
    const calledUrl = mockOpenMailto.mock.calls[0]![0]!;
    expect(calledUrl).toContain("mailto:registration@test.example");
    expect(calledUrl).toContain(
      encodeURIComponent("[MediaPulse] Newsletter Subscription - BBCA"),
    );
    expect(calledUrl).toContain(encodeURIComponent("test@example.com"));

    // Assert Success screen rendered
    expect(
      screen.getByText(/Your subscription request is being processed/i),
    ).toBeInTheDocument();
  });
});
