/** @vitest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/env/app-user-registration", () => ({
  env: {
    AGENT_DATA_API_URL: "http://agent-data-api.internal",
    NEXT_PUBLIC_REGISTRATION_EMAIL: "registration@example.com",
  },
}));

import { UnsubscribeConfirm } from "./unsubscribe-confirm";

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("UnsubscribeConfirm", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the confirm prompt with the ticker symbol", () => {
    render(
      <UnsubscribeConfirm
        token="token-123"
        tickerSymbol="BBCA"
        language="en"
      />,
    );

    expect(
      screen.getByRole("heading", { name: /Unsubscribe\?/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/BBCA updates/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Confirm unsubscribe/i }),
    ).toBeInTheDocument();
  });

  it("posts the token on confirm and renders the success outcome", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: "unsubscribed", displaySymbol: "BBCA" }),
    );
    render(
      <UnsubscribeConfirm
        token="token-123"
        tickerSymbol="BBCA"
        language="en"
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /Confirm unsubscribe/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/You've been unsubscribed from BBCA updates\./),
      ).toBeInTheDocument();
    });
    const resubscribeLink = screen.getByRole("link", {
      name: /Subscribe again/i,
    });
    expect(resubscribeLink).toHaveAttribute("href", "/");
    expect(fetchMock).toHaveBeenCalledWith("/api/unsubscribe/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "token-123" }),
    });
  });

  it("renders the already-unsubscribed outcome", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: "already_unsubscribed", displaySymbol: "BBCA" }),
    );
    render(
      <UnsubscribeConfirm
        token="token-123"
        tickerSymbol="BBCA"
        language="en"
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /Confirm unsubscribe/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/You're already unsubscribed from BBCA updates\./),
      ).toBeInTheDocument();
    });
  });

  it("renders a fallback message when the request throws", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network"));
    render(
      <UnsubscribeConfirm
        token="token-123"
        tickerSymbol="BBCA"
        language="en"
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /Confirm unsubscribe/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument();
    });
  });
});
