import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSubscribeMailAppModal } from "./use-subscribe-mail-app-modal";
import type { Ticker } from "@/lib/tickers";

vi.mock("@mediapulse/env/app-user-registration", () => ({
  env: { NEXT_PUBLIC_REGISTRATION_EMAIL: "registration@test.example" },
}));

const firstTicker: Ticker = {
  KodeEmiten: "ADES",
  NamaEmiten: "Akasha Wira International Tbk",
};

const renderModalHook = () => {
  const fetchConfirmRequest = vi.fn().mockResolvedValue({ ok: true as const });
  const onEmailComplete = vi.fn();
  const rendered = renderHook(() =>
    useSubscribeMailAppModal({
      name: "Kevin",
      language: "id",
      selectedTicker: firstTicker,
      onMailAppComplete: vi.fn(),
      onEmailComplete,
      fetchConfirmRequest,
      detectPlatform: () => "other",
    }),
  );

  return { ...rendered, fetchConfirmRequest, onEmailComplete };
};

describe("useSubscribeMailAppModal", () => {
  it("keeps the typed email after a confirmation email is sent", async () => {
    const { result, fetchConfirmRequest, onEmailComplete } = renderModalHook();

    act(() => {
      result.current.setConfirmationEmail("Kevin@Example.com ");
    });

    await act(async () => {
      await result.current.handleSendConfirmationEmail();
    });

    expect(fetchConfirmRequest).toHaveBeenCalledWith({
      email: "kevin@example.com",
      name: "Kevin",
      tickerSymbol: "ADES",
      language: "id",
    });
    expect(onEmailComplete).toHaveBeenCalledWith("kevin@example.com");
    expect(result.current.confirmEmailOpen).toBe(false);
    expect(result.current.confirmationEmail).toBe("Kevin@Example.com ");
  });

  it("keeps the typed email when the modals are reset for another ticker", () => {
    const { result } = renderModalHook();

    act(() => {
      result.current.handleSelectOther();
      result.current.setConfirmationEmail("kevin@example.com");
    });

    act(() => {
      result.current.resetSubscribeModals();
    });

    expect(result.current.confirmEmailOpen).toBe(false);
    expect(result.current.mailChoiceOpen).toBe(false);
    expect(result.current.confirmationEmail).toBe("kevin@example.com");
  });
});
