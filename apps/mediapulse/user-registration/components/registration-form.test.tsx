import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RegistrationForm } from "./registration-form";
import type { Ticker } from "@/lib/tickers";

const sampleTickers: Ticker[] = [
  { KodeEmiten: "AADI", NamaEmiten: "PT Adaro Andalan Indonesia Tbk" },
  { KodeEmiten: "BBCA", NamaEmiten: "Bank Central Asia Tbk" },
  { KodeEmiten: "TLKM", NamaEmiten: "Telkom Indonesia Tbk" },
];

const mockFetchData = vi.fn();

vi.mock("@/app/register/action/.generated/use-server-function", () => {
  return {
    useServerFunction: vi.fn(),
  };
});

import { useServerFunction } from "@/app/register/action/.generated/use-server-function";

describe("RegistrationForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockFetchData.mockReset();
  });

  it("renders the email and ticker search inputs", () => {
    // Setup
    vi.mocked(useServerFunction).mockReturnValue({
      fetchData: mockFetchData,
      pending: false,
      data: null,
      error: null,
    });

    // Act
    render(<RegistrationForm tickers={sampleTickers} />);

    // Assert
    expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Stock ticker/i)).toBeInTheDocument();
  });

  it("renders the subscribe button as disabled when no ticker is selected", () => {
    // Setup
    vi.mocked(useServerFunction).mockReturnValue({
      fetchData: mockFetchData,
      pending: false,
      data: null,
      error: null,
    });

    // Act
    render(<RegistrationForm tickers={sampleTickers} />);

    // Assert
    expect(screen.getByRole("button", { name: /Subscribe/i })).toBeDisabled();
  });

  it("shows ticker dropdown when search input is focused", async () => {
    // Setup
    vi.mocked(useServerFunction).mockReturnValue({
      fetchData: mockFetchData,
      pending: false,
      data: null,
      error: null,
    });
    const user = userEvent.setup();
    render(<RegistrationForm tickers={sampleTickers} />);

    // Act
    await user.click(screen.getByLabelText(/Stock ticker/i));

    // Assert
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("calls fetchData with form data when submitted", async () => {
    // Setup
    vi.mocked(useServerFunction).mockReturnValue({
      fetchData: mockFetchData,
      pending: false,
      data: null,
      error: null,
    });
    const user = userEvent.setup();
    render(<RegistrationForm tickers={sampleTickers} />);

    // Act
    await user.type(
      screen.getByLabelText(/Email address/i),
      "test@example.com",
    );
    await user.type(screen.getByLabelText(/Full name/i), "John Doe");
    await user.click(screen.getByLabelText(/Stock ticker/i));
    await user.click(screen.getByText("BBCA"));
    await user.click(screen.getByRole("button", { name: /Subscribe/i }));

    // Assert
    expect(mockFetchData).toHaveBeenCalledWith({
      body: {
        email: "test@example.com",
        name: "John Doe",
        tickerSymbol: "BBCA",
      },
      params: {},
    });
  });

  it("shows success message when data is present", () => {
    // Setup
    vi.mocked(useServerFunction).mockReturnValue({
      fetchData: mockFetchData,
      pending: false,
      data: { success: true, message: "Success" },
      error: null,
    });

    // Act
    render(<RegistrationForm tickers={sampleTickers} />);

    // Assert
    expect(screen.getByText(/Subscription Confirmed/i)).toBeInTheDocument();
  });
});
