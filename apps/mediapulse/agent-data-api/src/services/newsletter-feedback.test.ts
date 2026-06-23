/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {
    newsletterFeedback: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    userTicker: { findUnique: vi.fn() },
    newsletter: { findUnique: vi.fn() },
    mediapulseUser: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@mediapulse/database";
import {
  parseNewsletterMessageId,
  recordNewsletterFeedback,
} from "./newsletter-feedback.js";

const NEWSLETTER_ID = "11111111-1111-4111-a111-111111111111";
const USER_TICKER_ID = "22222222-2222-4222-a222-222222222222";
const USER_ID = "33333333-3333-4333-a333-333333333333";

const BASE_INPUT = {
  graphMessageId: "graph-1",
  senderEmail: "Reader@Example.com",
  subject: "Re: Your newsletter",
  rawBody: "Loved it",
  receivedAt: "2026-01-01T10:00:00.000Z",
  sentiment: "positive" as const,
  category: "praise" as const,
  classifierModel: "claude-opus-4-8",
};

describe("parseNewsletterMessageId", () => {
  it("extracts newsletter and userTicker ids from a self-describing Message-ID", () => {
    // Act
    const parsed = parseNewsletterMessageId(
      `<nl.${NEWSLETTER_ID}.${USER_TICKER_ID}@mediapulse>`,
    );

    // Assert
    expect(parsed).toEqual({
      newsletterId: NEWSLETTER_ID,
      userTickerId: USER_TICKER_ID,
    });
  });

  it("returns null for unrelated headers", () => {
    // Assert
    expect(parseNewsletterMessageId("<random@mail.example.com>")).toBeNull();
    expect(parseNewsletterMessageId(null)).toBeNull();
    expect(parseNewsletterMessageId(undefined)).toBeNull();
  });
});

describe("recordNewsletterFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("correlates via the self-describing Message-ID and stores the row", async () => {
    // Setup
    vi.mocked(prisma.newsletterFeedback.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.userTicker.findUnique).mockResolvedValue({
      id: USER_TICKER_ID,
      userId: USER_ID,
    } as never);
    vi.mocked(prisma.newsletter.findUnique).mockResolvedValue({
      id: NEWSLETTER_ID,
    } as never);
    vi.mocked(prisma.newsletterFeedback.create).mockResolvedValue({
      id: "feedback-1",
    } as never);

    // Act
    const result = await recordNewsletterFeedback({
      ...BASE_INPUT,
      inReplyToMessageId: `<nl.${NEWSLETTER_ID}.${USER_TICKER_ID}@mediapulse>`,
    });

    // Assert
    expect(result).toEqual({
      feedbackId: "feedback-1",
      created: true,
      correlated: {
        userId: USER_ID,
        userTickerId: USER_TICKER_ID,
        newsletterId: NEWSLETTER_ID,
      },
    });
    expect(prisma.mediapulseUser.findUnique).not.toHaveBeenCalled();
    const createArg = vi.mocked(prisma.newsletterFeedback.create).mock
      .calls[0]![0];
    expect(createArg.data.senderEmail).toBe("reader@example.com");
    expect(createArg.data.newsletterId).toBe(NEWSLETTER_ID);
  });

  it("falls back to the sender email when no header correlation exists", async () => {
    // Setup
    vi.mocked(prisma.newsletterFeedback.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.mediapulseUser.findUnique).mockResolvedValue({
      id: USER_ID,
    } as never);
    vi.mocked(prisma.newsletterFeedback.create).mockResolvedValue({
      id: "feedback-2",
    } as never);

    // Act
    const result = await recordNewsletterFeedback({
      ...BASE_INPUT,
      inReplyToMessageId: null,
    });

    // Assert
    expect(result.correlated).toEqual({ userId: USER_ID });
    expect(prisma.mediapulseUser.findUnique).toHaveBeenCalledWith({
      where: { email: "reader@example.com" },
      select: { id: true },
    });
  });

  it("is idempotent: returns the existing row without creating", async () => {
    // Setup
    vi.mocked(prisma.newsletterFeedback.findUnique).mockResolvedValue({
      id: "feedback-existing",
      userId: USER_ID,
      userTickerId: null,
      newsletterId: null,
    } as never);

    // Act
    const result = await recordNewsletterFeedback(BASE_INPUT);

    // Assert
    expect(result).toEqual({
      feedbackId: "feedback-existing",
      created: false,
      correlated: { userId: USER_ID },
    });
    expect(prisma.newsletterFeedback.create).not.toHaveBeenCalled();
  });
});
