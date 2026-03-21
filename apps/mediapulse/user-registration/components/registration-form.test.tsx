import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RegistrationForm } from "./registration-form";
import type { Ticker } from "@/lib/tickers";

const sampleTickers: Ticker[] = [
  { KodeEmiten: "AADI", NamaEmiten: "PT Adaro Andalan Indonesia Tbk" },
  { KodeEmiten: "BBCA", NamaEmiten: "Bank Central Asia Tbk" },
  { KodeEmiten: "TLKM", NamaEmiten: "Telkom Indonesia Tbk" },
];

describe("RegistrationForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the ticker search input", () => {
    // Act
    render(<RegistrationForm tickers={sampleTickers} />);

    // Assert
    expect(screen.getByLabelText("Stock ticker")).toBeInTheDocument();
  });

  it("renders the subscribe button as disabled when no ticker is selected", () => {
    // Act
    render(<RegistrationForm tickers={sampleTickers} />);

    // Assert
    expect(
      screen.getByRole("button", { name: "Subscribe via Email" }),
    ).toBeDisabled();
  });

  it("shows ticker dropdown when search input is focused", async () => {
    // Setup
    const user = userEvent.setup();
    render(<RegistrationForm tickers={sampleTickers} />);

    // Act
    await user.click(screen.getByLabelText("Stock ticker"));

    // Assert
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("filters ticker options as user types", async () => {
    // Setup
    const user = userEvent.setup();
    render(<RegistrationForm tickers={sampleTickers} />);

    // Act
    await user.type(screen.getByLabelText("Stock ticker"), "bank");

    // Assert
    const options = screen.getAllByRole("option");

    expect(options).toHaveLength(1);
    expect(options.at(0)).toHaveTextContent("BBCA");
  });

  it("shows no-results message when search yields no matches", async () => {
    // Setup
    const user = userEvent.setup();
    render(<RegistrationForm tickers={sampleTickers} />);

    // Act
    await user.type(screen.getByLabelText("Stock ticker"), "xyz999");

    // Assert
    expect(screen.getByText(/No tickers found for/)).toBeInTheDocument();
  });

  it("selects a ticker on click and closes the dropdown", async () => {
    // Setup
    const user = userEvent.setup();
    render(<RegistrationForm tickers={sampleTickers} />);

    await user.click(screen.getByLabelText("Stock ticker"));

    // Act
    const [firstOption] = screen.getAllByRole("option");

    await user.click(firstOption!);

    // Assert
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows the selected ticker code in the input after selection", async () => {
    // Setup
    const user = userEvent.setup();
    render(<RegistrationForm tickers={sampleTickers} />);

    await user.click(screen.getByLabelText("Stock ticker"));

    // Act
    const [firstOption] = screen.getAllByRole("option");

    await user.click(firstOption!);

    // Assert
    const tickerInput = screen.getByLabelText(
      "Stock ticker",
    ) as HTMLInputElement;

    expect(tickerInput.value).toContain("AADI");
  });

  it("enables the subscribe button after a ticker is selected", async () => {
    // Setup
    const user = userEvent.setup();
    render(<RegistrationForm tickers={sampleTickers} />);

    // Act
    await user.click(screen.getByLabelText("Stock ticker"));

    const [firstOption] = screen.getAllByRole("option");

    await user.click(firstOption!);

    // Assert
    expect(
      screen.getByRole("button", { name: "Subscribe via Email" }),
    ).not.toBeDisabled();
  });

  it("calls openMailto with a mailto url when form is submitted", async () => {
    // Setup
    const openMailto = vi.fn();
    const user = userEvent.setup();
    render(
      <RegistrationForm tickers={sampleTickers} openMailto={openMailto} />,
    );

    await user.click(screen.getByLabelText("Stock ticker"));

    const [firstOption] = screen.getAllByRole("option");

    await user.click(firstOption!);

    // Act
    await user.click(
      screen.getByRole("button", { name: "Subscribe via Email" }),
    );

    // Assert
    expect(openMailto).toHaveBeenCalledOnce();

    expect(openMailto).toHaveBeenCalledWith(
      expect.stringMatching(/^mailto:mediapulse@hyperjump\.tech/),
    );
  });

  it("does not call openMailto when no ticker is selected", () => {
    // Setup
    const openMailto = vi.fn();
    render(
      <RegistrationForm tickers={sampleTickers} openMailto={openMailto} />,
    );

    // Act
    const form = screen
      .getByRole("button", { name: "Subscribe via Email" })
      .closest("form") as HTMLFormElement;
    fireEvent.submit(form);

    // Assert
    expect(openMailto).not.toHaveBeenCalled();
  });

  it("renders the warning note about not modifying the email", () => {
    // Act
    render(<RegistrationForm tickers={sampleTickers} />);

    // Assert
    expect(
      screen.getByText(
        /Please do not modify the subject or content before sending/,
      ),
    ).toBeInTheDocument();
  });

  it("closes the dropdown when clicking outside the picker", async () => {
    // Setup
    const user = userEvent.setup();

    render(
      <div>
        <RegistrationForm tickers={sampleTickers} />
        <button data-testid="outside">Outside</button>
      </div>,
    );

    await user.click(screen.getByLabelText("Stock ticker"));

    expect(screen.getByRole("listbox")).toBeInTheDocument();

    // Act
    fireEvent.mouseDown(screen.getByTestId("outside"));

    // Assert
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
