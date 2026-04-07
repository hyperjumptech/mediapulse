import * as React from "react";
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useRegistrationForm } from "./use-registration-form";
import type { Ticker } from "@/lib/tickers";

const sampleTickers: Ticker[] = [
  { KodeEmiten: "AADI", NamaEmiten: "PT Adaro Andalan Indonesia Tbk" },
  { KodeEmiten: "BBCA", NamaEmiten: "Bank Central Asia Tbk" },
];

describe("useRegistrationForm", () => {
  it("initializes with default state", () => {
    const mockOpenMailto = vi.fn();
    const { result } = renderHook(() =>
      useRegistrationForm(sampleTickers, mockOpenMailto)
    );

    expect(result.current.email).toBe("");
    expect(result.current.name).toBe("");
    expect(result.current.query).toBe("");
    expect(result.current.selectedTicker).toBeNull();
    expect(result.current.open).toBe(false);
    expect(result.current.submitted).toBe(false);
  });

  it("handles query changes and toggles dropdown", () => {
    const mockOpenMailto = vi.fn();
    const { result } = renderHook(() =>
      useRegistrationForm(sampleTickers, mockOpenMailto)
    );

    act(() => {
      result.current.handleQueryChange({
        target: { value: "Bank" },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.query).toBe("Bank");
    expect(result.current.open).toBe(true);
    expect(result.current.selectedTicker).toBeNull();
  });

  it("selects a ticker and formats the query", () => {
    const mockOpenMailto = vi.fn();
    const { result } = renderHook(() =>
      useRegistrationForm(sampleTickers, mockOpenMailto)
    );

    act(() => {
      result.current.handleTickerSelect(sampleTickers[1]!); // BBCA
    });

    expect(result.current.selectedTicker).toEqual(sampleTickers[1]);
    expect(result.current.query).toBe("BBCA - Bank Central Asia Tbk");
    expect(result.current.open).toBe(false);
  });

  it("submits the form if both email and ticker exist", async () => {
    const mockOpenMailto = vi.fn();
    const { result } = renderHook(() =>
      useRegistrationForm(sampleTickers, mockOpenMailto)
    );

    act(() => {
      result.current.setEmail("test@test.com");
      result.current.setName("Test User");
      result.current.handleTickerSelect(sampleTickers[1]!);
    });

    await act(async () => {
      const e = { preventDefault: vi.fn() } as unknown as React.FormEvent<HTMLFormElement>;
      await result.current.handleSubmit(e);
    });

    expect(mockOpenMailto).toHaveBeenCalledTimes(1);
    expect(result.current.submitted).toBe(true);
  });

  it("does not submit if email or ticker are missing", async () => {
    const mockOpenMailto = vi.fn();
    const { result } = renderHook(() =>
      useRegistrationForm(sampleTickers, mockOpenMailto)
    );

    await act(async () => {
      const e = { preventDefault: vi.fn() } as unknown as React.FormEvent<HTMLFormElement>;
      await result.current.handleSubmit(e);
    });

    expect(mockOpenMailto).not.toHaveBeenCalled();
    expect(result.current.submitted).toBe(false);
  });

  it("resets form when resetForm is called", () => {
    const mockOpenMailto = vi.fn();
    const { result } = renderHook(() =>
      useRegistrationForm(sampleTickers, mockOpenMailto)
    );

    act(() => {
      result.current.setEmail("test@test.com");
      result.current.handleTickerSelect(sampleTickers[1]!);
    });

    expect(result.current.email).toBe("test@test.com");
    expect(result.current.selectedTicker).not.toBeNull();

    act(() => {
      result.current.resetForm();
    });

    expect(result.current.email).toBe("");
    expect(result.current.name).toBe("");
    expect(result.current.query).toBe("");
    expect(result.current.selectedTicker).toBeNull();
    expect(result.current.submitted).toBe(false);
  });
});
