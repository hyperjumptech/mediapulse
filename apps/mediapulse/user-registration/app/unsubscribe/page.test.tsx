/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/env/app-user-registration", () => ({
  env: {
    AGENT_DATA_API_URL: "http://agent-data-api.internal",
    UNSUBSCRIBE_SECRET: "test-secret",
    NEXT_PUBLIC_REGISTRATION_EMAIL: "registration@example.com",
  },
}));

const readUnsubscribeToken = vi.fn();
vi.mock("@/lib/read-unsubscribe-token", () => ({
  readUnsubscribeToken: (...args: unknown[]) => readUnsubscribeToken(...args),
}));

vi.mock("@/components/unsubscribe-confirm", () => ({
  UnsubscribeConfirm: ({ tickerSymbol }: { tickerSymbol: string }) => (
    <div data-testid="unsubscribe-confirm">{tickerSymbol}</div>
  ),
}));

vi.mock("@/components/hyperjump-product-attribution", () => ({
  HyperjumpProductAttribution: () => <div data-testid="attribution" />,
}));

import UnsubscribePage from "./page";

describe("UnsubscribePage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the confirm control for a valid token", async () => {
    readUnsubscribeToken.mockReturnValue({ valid: true, tickerSymbol: "BBCA" });

    const ui = await UnsubscribePage({
      searchParams: Promise.resolve({ token: "token-123" }),
    });
    render(ui);

    expect(screen.getByTestId("unsubscribe-confirm")).toHaveTextContent("BBCA");
  });

  it("shows the expired message and no confirm control for an expired token", async () => {
    readUnsubscribeToken.mockReturnValue({ valid: false, reason: "expired" });

    const ui = await UnsubscribePage({
      searchParams: Promise.resolve({ token: "token-123" }),
    });
    render(ui);

    expect(screen.getByText(/has expired/i)).toBeInTheDocument();
    expect(screen.queryByTestId("unsubscribe-confirm")).not.toBeInTheDocument();
  });

  it("shows the invalid message for an invalid token", async () => {
    readUnsubscribeToken.mockReturnValue({ valid: false, reason: "invalid" });

    const ui = await UnsubscribePage({
      searchParams: Promise.resolve({}),
    });
    render(ui);

    expect(screen.getByText(/is invalid/i)).toBeInTheDocument();
    expect(screen.queryByTestId("unsubscribe-confirm")).not.toBeInTheDocument();
  });

  it("uses Indonesian copy when lang=id", async () => {
    readUnsubscribeToken.mockReturnValue({ valid: false, reason: "expired" });

    const ui = await UnsubscribePage({
      searchParams: Promise.resolve({ token: "token-123", lang: "id" }),
    });
    render(ui);

    expect(screen.getByText(/telah kedaluwarsa/i)).toBeInTheDocument();
  });
});
