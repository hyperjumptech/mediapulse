/** @vitest-environment node */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

vi.mock("../services/newsletter-feedback.js", () => ({
  recordNewsletterFeedback: vi.fn(),
}));

import { recordNewsletterFeedback } from "../services/newsletter-feedback.js";
import { postNewsletterFeedbackRecordHandler } from "./newsletter-feedback.js";

describe("postNewsletterFeedbackRecordHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records feedback and returns the service result as JSON", async () => {
    // Setup
    vi.mocked(recordNewsletterFeedback).mockResolvedValue({
      feedbackId: "11111111-1111-4111-a111-111111111111",
      created: true,
      correlated: { userId: "22222222-2222-4222-a222-222222222222" },
    });
    const app = new Hono();
    app.post("/feedback", postNewsletterFeedbackRecordHandler);

    // Act
    const response = await app.request("http://localhost/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        graphMessageId: "graph-1",
        senderEmail: "reader@example.com",
        rawBody: "Great work!",
        receivedAt: "2026-01-01T10:00:00.000Z",
        sentiment: "positive",
        category: "praise",
      }),
    });

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      feedbackId: "11111111-1111-4111-a111-111111111111",
      created: true,
      correlated: { userId: "22222222-2222-4222-a222-222222222222" },
    });
    expect(recordNewsletterFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        graphMessageId: "graph-1",
        senderEmail: "reader@example.com",
        sentiment: "positive",
        category: "praise",
      }),
    );
  });

  it("rejects an invalid body without calling the service", async () => {
    // Setup
    const app = new Hono();
    app.post("/feedback", postNewsletterFeedbackRecordHandler);

    // Act
    const response = await app.request("http://localhost/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ graphMessageId: "graph-1" }),
    });

    // Assert
    expect(response.status).toBe(400);
    expect(recordNewsletterFeedback).not.toHaveBeenCalled();
  });
});
