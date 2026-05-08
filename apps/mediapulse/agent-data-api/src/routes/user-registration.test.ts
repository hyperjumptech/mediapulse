/** @vitest-environment node */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

vi.mock("@mediapulse/env", () => ({
  env: {
    UNSUBSCRIBE_SECRET: "test-unsubscribe-secret",
  },
}));

vi.mock("../services/user-registration.js", () => ({
  processRegistration: vi.fn(),
  confirmRegistration: vi.fn(),
  processUnsubscribe: vi.fn(),
}));

import { processUnsubscribe } from "../services/user-registration.js";
import {
  getUserRegistrationUnsubscribeHandler,
  postUserRegistrationUnsubscribeHandler,
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
});
