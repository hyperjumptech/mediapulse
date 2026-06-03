import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RegistrationForm } from "./registration-form";
import type { Ticker } from "@/lib/tickers";

vi.mock("@mediapulse/env/app-user-registration", () => ({
  env: { NEXT_PUBLIC_REGISTRATION_EMAIL: "registration@test.example" },
}));

vi.mock("@workspace/utils", () => ({
  buildVCard: vi.fn(
    ({ name, email }: { name: string; email: string }) =>
      `BEGIN:VCARD\r\nFN:${name}\r\nEMAIL:${email}\r\nEND:VCARD`,
  ),
}));

const sampleTickers: Ticker[] = [
  { KodeEmiten: "AADI", NamaEmiten: "PT Adaro Andalan Indonesia Tbk" },
  { KodeEmiten: "BBCA", NamaEmiten: "Bank Central Asia Tbk" },
  { KodeEmiten: "TLKM", NamaEmiten: "Telkom Indonesia Tbk" },
];

describe("RegistrationForm", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:mock-url"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the name and ticker search inputs", () => {
    // Act
    render(<RegistrationForm tickers={sampleTickers} openMailto={vi.fn()} />);

    // Assert
    expect(screen.getByLabelText(/Your name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Stock ticker/i)).toBeInTheDocument();
  });

  it("renders the subscribe button as disabled when no ticker is selected", () => {
    // Act
    render(<RegistrationForm tickers={sampleTickers} openMailto={vi.fn()} />);

    // Assert
    expect(
      screen.getByRole("button", { name: /Open email app to subscribe/i }),
    ).toBeDisabled();
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
    await user.type(screen.getByLabelText(/Your name/i), "John Doe");

    // Select Ticker
    await user.click(screen.getByLabelText(/Stock ticker/i));
    await user.click(screen.getByText(/Bank Central Asia Tbk/i));

    // Submit
    const subscribeBtn = screen.getByRole("button", {
      name: /Open email app to subscribe/i,
    });
    expect(subscribeBtn).not.toBeDisabled();
    await user.click(subscribeBtn);

    // Assert mailto was called
    expect(mockOpenMailto).toHaveBeenCalledTimes(1);
    const calledUrl = mockOpenMailto.mock.calls[0]![0]!;
    expect(calledUrl).toContain("mailto:registration@test.example");
    expect(calledUrl).toContain(
      encodeURIComponent("[MediaPulse] Newsletter Subscription - BBCA"),
    );
    expect(calledUrl).toContain(encodeURIComponent("Name: John Doe"));
    expect(calledUrl).toContain(encodeURIComponent("Ticker: BBCA"));

    // Assert Success screen rendered
    expect(screen.getByText(/Almost done/i)).toBeInTheDocument();
    expect(screen.getByText(/tap/i)).toBeInTheDocument();
    expect(screen.getByText(/Send/i)).toBeInTheDocument();
  });

  it("shows spam/junk reassurance text and 'Add to contacts' button after submit", async () => {
    // Setup
    const user = userEvent.setup();
    render(<RegistrationForm tickers={sampleTickers} openMailto={vi.fn()} />);

    await user.type(screen.getByLabelText(/Your name/i), "Jane");
    await user.click(screen.getByLabelText(/Stock ticker/i));
    await user.click(screen.getByText(/Bank Central Asia Tbk/i));
    await user.click(
      screen.getByRole("button", { name: /Open email app to subscribe/i }),
    );

    // Assert
    expect(screen.getByText(/spam|junk/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Add MediaPulse to your contacts/i }),
    ).toBeInTheDocument();
  });

  it("triggers a vCard download when 'Add to contacts' is clicked", async () => {
    // Setup
    const user = userEvent.setup();
    render(<RegistrationForm tickers={sampleTickers} openMailto={vi.fn()} />);

    await user.type(screen.getByLabelText(/Your name/i), "Jane");
    await user.click(screen.getByLabelText(/Stock ticker/i));
    await user.click(screen.getByText(/Bank Central Asia Tbk/i));
    await user.click(
      screen.getByRole("button", { name: /Open email app to subscribe/i }),
    );

    // Spy on createElement after render so the mock only captures the anchor
    // created by downloadVCard, not elements created by React during rendering.
    const anchorClickSpy = vi.fn();
    const mockAnchor = { href: "", download: "", click: anchorClickSpy };
    vi.spyOn(document, "createElement").mockReturnValueOnce(
      mockAnchor as unknown as HTMLElement,
    );

    // Act
    await user.click(
      screen.getByRole("button", { name: /Add MediaPulse to your contacts/i }),
    );

    // Assert
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(mockAnchor.download).toBe("MediaPulse.vcf");
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
  });
});
