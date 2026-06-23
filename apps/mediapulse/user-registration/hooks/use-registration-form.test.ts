import * as React from "react";
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useRegistrationForm } from "./use-registration-form";
import type { Ticker } from "@/lib/tickers";
import { openMailClientUrl } from "@/lib/mail-app-urls";

vi.mock("@mediapulse/env/app-user-registration", () => ({
  env: { NEXT_PUBLIC_REGISTRATION_EMAIL: "registration@test.example" },
}));

vi.mock("@/lib/mail-app-urls", () => ({
  buildMailtoUrl: vi.fn(() => "mailto:test@example.com"),
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

const sampleTickers: Ticker[] = [
  { KodeEmiten: "AADI", NamaEmiten: "PT Adaro Andalan Indonesia Tbk" },
  { KodeEmiten: "BBCA", NamaEmiten: "Bank Central Asia Tbk" },
];

describe("useRegistrationForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with default state", () => {
    const { result } = renderHook(() => useRegistrationForm(sampleTickers));

    expect(result.current.name).toBe("");
    expect(result.current.language).toBe("en");
    expect(result.current.query).toBe("");
    expect(result.current.selectedTicker).toBeNull();
    expect(result.current.open).toBe(false);
    expect(result.current.submitted).toBe(false);
    expect(result.current.mailChoiceOpen).toBe(false);
  });

  it("opens the mail choice modal on submit when form is valid", async () => {
    const { result } = renderHook(() => useRegistrationForm(sampleTickers));

    act(() => {
      result.current.setName("Test User");
      result.current.handleTickerSelect(sampleTickers[1]!);
    });

    await act(async () => {
      const e = {
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent<HTMLFormElement>;
      await result.current.handleSubmit(e);
    });

    expect(result.current.mailChoiceOpen).toBe(true);
    expect(result.current.submitted).toBe(false);
  });

  it("does not open modal when name or ticker are missing", async () => {
    const { result } = renderHook(() => useRegistrationForm(sampleTickers));

    await act(async () => {
      const e = {
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent<HTMLFormElement>;
      await result.current.handleSubmit(e);
    });

    expect(result.current.mailChoiceOpen).toBe(false);
  });

  it("completes mail-app path when native mail is selected", () => {
    const { result } = renderHook(() => useRegistrationForm(sampleTickers));

    act(() => {
      result.current.setName("Test User");
      result.current.handleTickerSelect(sampleTickers[1]!);
    });

    act(() => {
      result.current.handleSelectNativeMail();
    });

    expect(vi.mocked(openMailClientUrl)).toHaveBeenCalledWith(
      "mailto:test@example.com",
    );
    expect(result.current.submitted).toBe(true);
    expect(result.current.submissionMode).toBe("mailto");
  });

  it("keeps name and language when resetForm is called after submit", () => {
    const { result } = renderHook(() => useRegistrationForm(sampleTickers));

    act(() => {
      result.current.setName("Test");
      result.current.setLanguage("id");
      result.current.handleTickerSelect(sampleTickers[1]!);
      result.current.handleSelectNativeMail();
    });

    act(() => {
      result.current.resetForm();
    });

    expect(result.current.name).toBe("Test");
    expect(result.current.language).toBe("id");
    expect(result.current.query).toBe("");
    expect(result.current.selectedTicker).toBeNull();
    expect(result.current.submitted).toBe(false);
    expect(result.current.mailChoiceOpen).toBe(false);
  });
});
