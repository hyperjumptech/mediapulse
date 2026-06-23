import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RegistrationForm } from "./registration-form";
import type { Ticker } from "@/lib/tickers";
import { openMailClientUrl } from "@/lib/mail-app-urls";

vi.mock("@mediapulse/env/app-user-registration", () => ({
  env: { NEXT_PUBLIC_REGISTRATION_EMAIL: "registration@test.example" },
}));

vi.mock("@/lib/mail-app-urls", () => ({
  buildMailtoUrl: vi.fn(
    () => "mailto:registration@test.example?subject=test&body=test",
  ),
  buildOutlookComposeUrl: vi.fn(() => "ms-outlook:compose?test=1"),
  openMailClientUrl: vi.fn(),
}));

vi.mock("@/lib/detect-mail-platform", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/detect-mail-platform")>();
  return {
    ...actual,
    detectMailPlatform: () => "macos" as const,
  };
});

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

const fillAndSubmitForm = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(
    screen.getByLabelText(/What should we call you\?/i),
    "John Doe",
  );
  await user.click(screen.getByLabelText(/Stock ticker/i));
  await user.click(screen.getByText(/Bank Central Asia Tbk/i));
  await user.click(screen.getByRole("button", { name: /^Subscribe$/i }));
};

describe("RegistrationForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:mock-url"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the name, language, and ticker search inputs", () => {
    render(<RegistrationForm tickers={sampleTickers} />);

    expect(
      screen.getByLabelText(/What should we call you\?/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Stock ticker/i)).toBeInTheDocument();

    const languageSelect = screen.getByLabelText(
      /Newsletter language/i,
    ) as HTMLSelectElement;

    expect(languageSelect).toBeInTheDocument();
    expect(languageSelect.value).toBe("en");
  });

  it("renders the subscribe button as disabled when no ticker is selected", () => {
    render(<RegistrationForm tickers={sampleTickers} />);

    expect(screen.getByRole("button", { name: /^Subscribe$/i })).toBeDisabled();
  });

  it("shows ticker dropdown when search input is focused", async () => {
    const user = userEvent.setup();
    render(<RegistrationForm tickers={sampleTickers} />);

    await user.click(screen.getByLabelText(/Stock ticker/i));

    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("opens the mail choice modal on submit and completes native mail path", async () => {
    const user = userEvent.setup();
    render(<RegistrationForm tickers={sampleTickers} />);

    await fillAndSubmitForm(user);

    expect(
      screen.getByRole("dialog", { name: /Choose how to subscribe/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Apple Mail/i }));

    expect(vi.mocked(openMailClientUrl)).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Almost done/i)).toBeInTheDocument();
    expect(screen.getByText(/Send/i)).toBeInTheDocument();
  });

  it("shows spam/junk reassurance text after mail-app submit", async () => {
    const user = userEvent.setup();
    render(<RegistrationForm tickers={sampleTickers} />);

    await fillAndSubmitForm(user);
    await user.click(screen.getByRole("button", { name: /Apple Mail/i }));

    expect(screen.getByText(/spam|junk/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Download contact card/i }),
    ).toBeInTheDocument();
  });

  it("triggers a vCard download when download contact card is clicked", async () => {
    const user = userEvent.setup();
    render(<RegistrationForm tickers={sampleTickers} />);

    await fillAndSubmitForm(user);
    await user.click(screen.getByRole("button", { name: /Apple Mail/i }));

    const anchorClickSpy = vi.fn();
    const mockAnchor = { href: "", download: "", click: anchorClickSpy };
    vi.spyOn(document, "createElement").mockReturnValueOnce(
      mockAnchor as unknown as HTMLElement,
    );

    await user.click(
      screen.getByRole("button", { name: /Download contact card/i }),
    );

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(mockAnchor.download).toBe("MediaPulse.vcf");
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
  });
});
