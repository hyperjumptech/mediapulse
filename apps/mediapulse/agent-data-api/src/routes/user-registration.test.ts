/** @vitest-environment node */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

vi.mock("@mediapulse/env", () => ({
  env: {
    UNSUBSCRIBE_SECRET: "test-unsubscribe-secret",
    REGISTRATION_CONFIRM_SECRET: "test-registration-confirm-secret",
  },
}));

vi.mock("../services/user-registration.js", () => ({
  processRegistration: vi.fn(),
  confirmRegistration: vi.fn(),
  processUnsubscribe: vi.fn(),
  processWebSignup: vi.fn(),
  processConfirmSubscription: vi.fn(),
}));

vi.mock("../services/user-registration-tickers.js", () => ({
  listTickersForUserRegistration: vi.fn(),
}));

import {
  processUnsubscribe,
  processWebSignup,
  processConfirmSubscription,
} from "../services/user-registration.js";
import {
  getUserRegistrationUnsubscribeHandler,
  postUserRegistrationUnsubscribeHandler,
  postUserRegistrationWebSignupHandler,
  getUserRegistrationConfirmSubscriptionHandler,
} from "./user-registration.js";

describe("user-registration unsubscribe route handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns JSON for GET unsubscribe lookups", async () => {
    vi.mocked(processUnsubscribe).mockResolvedValue({
      status: "already_unsubscribed",
      displaySymbol: "BBCA",
    });
    const app = new Hono();
    app.get("/unsubscribe", getUserRegistrationUnsubscribeHandler);

    const response = await app.request(
      "http://localhost/unsubscribe?token=test-token",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "already_unsubscribed",
      displaySymbol: "BBCA",
    });
    expect(processUnsubscribe).toHaveBeenCalledWith({
      token: "test-token",
      secret: "test-unsubscribe-secret",
      method: "link",
    });
  });

  it("returns JSON for POST one-click unsubscribe", async () => {
    vi.mocked(processUnsubscribe).mockResolvedValue({
      status: "unsubscribed",
      displaySymbol: "BBCA",
    });
    const app = new Hono();
    app.post("/unsubscribe", postUserRegistrationUnsubscribeHandler);

    const response = await app.request("http://localhost/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "test-token" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "unsubscribed",
      displaySymbol: "BBCA",
    });
    expect(processUnsubscribe).toHaveBeenCalledWith({
      token: "test-token",
      secret: "test-unsubscribe-secret",
      method: "one_click",
    });
  });

  it("returns JSON for POST web signup", async () => {
    vi.mocked(processWebSignup).mockResolvedValue({
      ok: true,
      tickerKnown: true,
      userTickerId: "11111111-1111-4111-a111-111111111111",
      isNewSubscription: true,
    });
    const app = new Hono();
    app.post("/web-signup", postUserRegistrationWebSignupHandler);

    const response = await app.request("http://localhost/web-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alice@example.com",
        tickerSymbol: "BBCA",
        name: "Alice",
        language: "en",
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      tickerKnown: true,
      userTickerId: "11111111-1111-4111-a111-111111111111",
      isNewSubscription: true,
    });
  });

  it("returns JSON for GET confirm subscription", async () => {
    vi.mocked(processConfirmSubscription).mockResolvedValue({
      status: "confirmed",
      displaySymbol: "BBCA",
      email: "alice@example.com",
    });
    const app = new Hono();
    app.get(
      "/confirm-subscription",
      getUserRegistrationConfirmSubscriptionHandler,
    );

    const response = await app.request(
      "http://localhost/confirm-subscription?token=test-token",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "confirmed",
      displaySymbol: "BBCA",
      email: "alice@example.com",
    });
    expect(processConfirmSubscription).toHaveBeenCalledWith({
      token: "test-token",
      secret: "test-registration-confirm-secret",
    });
  });
});
