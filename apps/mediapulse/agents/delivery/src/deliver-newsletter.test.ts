/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Resend } from "resend";
import type { SlidingWindowRateLimiter } from "@workspace/utils";
import {
  DEFAULT_HYPERJUMP_SITE_URL,
  DEFAULT_MEDIAPULSE_SITE_URL,
  renderNewsletterEmail,
} from "@workspace/email-templates";

import { DeliveryConfigSchema } from "./config-schema.js";
import {
  buildNewsletterMessageId,
  deliverNewsletterToSubscribers,
  type DeliveryNewsletter,
} from "./deliver-newsletter.js";

describe("buildNewsletterMessageId", () => {
  it("embeds the newsletter and userTicker ids using the sender domain", () => {
    // Act
    const messageId = buildNewsletterMessageId(
      "news-1",
      "ut-1",
      '"MediaPulse" <news@mp.example.com>',
    );

    // Assert
    expect(messageId).toBe("<nl.news-1.ut-1@mp.example.com>");
  });

  it("falls back to a fixed domain when the sender has none", () => {
    // Act
    const messageId = buildNewsletterMessageId("news-1", "ut-1", "no-domain");

    // Assert
    expect(messageId).toBe("<nl.news-1.ut-1@mediapulse>");
  });
});

/**
 * Builds a test double for {@link SlidingWindowRateLimiter}.
 *
 * @param acquire - Optional acquire mock override.
 */
const mockRateLimiter = (
  acquire: SlidingWindowRateLimiter["acquire"] = vi.fn().mockResolvedValue(0),
): SlidingWindowRateLimiter => ({
  acquire,
  setWindowMs: vi.fn(),
  getWindowMs: vi.fn().mockReturnValue(1000),
});

vi.mock("@workspace/email-templates", async () => {
  const actual = await vi.importActual<
    typeof import("@workspace/email-templates")
  >("@workspace/email-templates");
  return {
    ...actual,
    renderNewsletterEmail: vi.fn(),
  };
});

const newsletter: DeliveryNewsletter = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  subject: "AAPL Pulse: Subject",
  content: "Body",
  symbol: "AAPL",
  translations: [],
};

const userTickerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("deliverNewsletterToSubscribers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(renderNewsletterEmail).mockResolvedValue({
      html: "<p>h</p>",
      text: "plain",
    });
  });

  const baseConfig = DeliveryConfigSchema.parse({
    resendApiKey: "re_k",
    resend: { from: "from@example.com" },
    unsubscribe: { secret: "test-secret", baseUrl: "https://example.com" },
  });

  it("renders per subscriber, injects unsubscribeUrl and List-Unsubscribe headers", async () => {
    const sendWithRetry = vi
      .fn()
      .mockResolvedValue({ id: "re_1", attempts: 1 });
    const acquire = vi.fn().mockResolvedValue(0);
    const logInfo = vi.fn();
    const logError = vi.fn();

    const { results, resendMessageIds } = await deliverNewsletterToSubscribers(
      newsletter,
      [{ userTickerId, email: "u@example.com", language: "en" }],
      [],
      baseConfig,
      {
        resend: {} as Resend,
        rateLimiter: mockRateLimiter(acquire),
        sendWithRetry,
        logger: { info: logInfo, error: logError },
      },
    );

    const renderCall = vi.mocked(renderNewsletterEmail).mock.calls[0]?.[0];
    expect(renderCall).toMatchObject({
      title: "Subject",
      bodyText: newsletter.content,
      variant: "default",
      unsubscribeUrl: expect.stringContaining(
        "https://example.com/api/unsubscribe",
      ),
      tickerSymbol: "AAPL",
      mediapulseSiteUrl: DEFAULT_MEDIAPULSE_SITE_URL,
      hyperjumpSiteUrl: DEFAULT_HYPERJUMP_SITE_URL,
    });
    expect(acquire).toHaveBeenCalledOnce();
    expect(sendWithRetry).toHaveBeenCalledOnce();
    const payload = sendWithRetry.mock.calls[0]?.[1];
    expect(payload).toMatchObject({
      html: "<p>h</p>",
      text: "plain",
      from: '"CEO (Chief Email Officer) - MediaPulse" <from@example.com>',
      to: "u@example.com",
      subject: newsletter.subject,
      headers: {
        "List-Unsubscribe": expect.stringContaining(
          "https://example.com/api/unsubscribe",
        ),
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "Message-ID": `<nl.${newsletter.id}.${userTickerId}@example.com>`,
      },
    });
    expect(results).toEqual([
      expect.objectContaining({
        userTickerId,
        status: "success",
        attempts: 1,
        resendEmailId: "re_1",
      }),
    ]);
    expect(resendMessageIds).toEqual(["re_1"]);
  });

  it("renders the translated subject and content for an id subscriber", async () => {
    const sendWithRetry = vi
      .fn()
      .mockResolvedValue({ id: "re_id", attempts: 1 });
    const translatedNewsletter: DeliveryNewsletter = {
      ...newsletter,
      translations: [
        { language: "id", subject: "AAPL Pulse: Subjek", content: "Isi" },
      ],
    };

    await deliverNewsletterToSubscribers(
      translatedNewsletter,
      [{ userTickerId, email: "u@example.com", language: "id" }],
      [],
      baseConfig,
      {
        resend: {} as Resend,
        rateLimiter: mockRateLimiter(),
        sendWithRetry,
      },
    );

    const renderCall = vi.mocked(renderNewsletterEmail).mock.calls[0]?.[0];
    expect(renderCall).toMatchObject({
      title: "Subjek",
      bodyText: "Isi",
    });

    expect(sendWithRetry.mock.calls[0]?.[1]).toMatchObject({
      subject: "AAPL Pulse: Subjek",
    });
  });

  it("skips an id subscriber without acquire or send when no translation exists", async () => {
    const sendWithRetry = vi.fn();
    const acquire = vi.fn().mockResolvedValue(0);
    const claimRecipient = vi.fn().mockResolvedValue(true);

    const { results, resendMessageIds } = await deliverNewsletterToSubscribers(
      newsletter,
      [{ userTickerId, email: "u@example.com", language: "id" }],
      [],
      baseConfig,
      {
        resend: {} as Resend,
        rateLimiter: mockRateLimiter(acquire),
        sendWithRetry,
        claimRecipient,
      },
    );

    expect(claimRecipient).not.toHaveBeenCalled();
    expect(acquire).not.toHaveBeenCalled();
    expect(sendWithRetry).not.toHaveBeenCalled();
    expect(results[0]).toMatchObject({
      status: "skipped",
      errorCategory: "skipped_missing_translation",
    });
    expect(resendMessageIds).toEqual([]);
  });

  it("skips checkpointed subscribers without acquire or send", async () => {
    const sendWithRetry = vi.fn();
    const acquire = vi.fn().mockResolvedValue(0);
    const logInfo = vi.fn();
    const logError = vi.fn();

    const { results, resendMessageIds } = await deliverNewsletterToSubscribers(
      newsletter,
      [{ userTickerId, email: "u@example.com", language: "en" }],
      [userTickerId],
      baseConfig,
      {
        resend: {} as Resend,
        rateLimiter: mockRateLimiter(acquire),
        sendWithRetry,
        logger: { info: logInfo, error: logError },
      },
    );

    expect(sendWithRetry).not.toHaveBeenCalled();
    expect(acquire).not.toHaveBeenCalled();
    expect(results[0]?.status).toBe("skipped");
    expect(resendMessageIds).toEqual([]);
    expect(logInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        successCount: 0,
        failedCount: 0,
        skippedCount: 1,
        totalRecipients: 1,
      }),
      "delivery recipient batch summary",
    );
  });

  it("omits html from the payload when send.includeHtml is false", async () => {
    const cfg = DeliveryConfigSchema.parse({
      resendApiKey: "re_k",
      resend: { from: "from@example.com" },
      send: { includeHtml: false, includeText: true },
      unsubscribe: {
        secret: "test-secret",
        baseUrl: "https://example.com/api",
      },
    });
    const sendWithRetry = vi
      .fn()
      .mockResolvedValue({ id: "re_2", attempts: 1 });

    await deliverNewsletterToSubscribers(
      newsletter,
      [{ userTickerId, email: "u@example.com", language: "en" }],
      [],
      cfg,
      {
        resend: {} as Resend,
        rateLimiter: mockRateLimiter(),
        sendWithRetry,
      },
    );

    const payload = sendWithRetry.mock.calls[0]?.[1];
    expect(payload).not.toHaveProperty("html");
    expect(payload).toMatchObject({ text: "plain" });
  });

  it("omits text from the payload when send.includeText is false", async () => {
    const cfg = DeliveryConfigSchema.parse({
      resendApiKey: "re_k",
      resend: { from: "from@example.com" },
      send: { includeHtml: true, includeText: false },
      unsubscribe: {
        secret: "test-secret",
        baseUrl: "https://example.com/api",
      },
    });
    const sendWithRetry = vi
      .fn()
      .mockResolvedValue({ id: "re_x", attempts: 1 });

    await deliverNewsletterToSubscribers(
      newsletter,
      [{ userTickerId, email: "u@example.com", language: "en" }],
      [],
      cfg,
      {
        resend: {} as Resend,
        rateLimiter: mockRateLimiter(),
        sendWithRetry,
      },
    );

    const payload = sendWithRetry.mock.calls[0]?.[1];
    expect(payload).not.toHaveProperty("text");
    expect(payload).toMatchObject({ html: "<p>h</p>" });
  });

  it("forwards resend.replyTo and resend.tags when configured", async () => {
    const cfg = DeliveryConfigSchema.parse({
      resendApiKey: "re_k",
      resend: {
        from: "from@example.com",
        replyTo: "replies@example.com",
        tags: [{ name: "env", value: "test" }],
      },
      unsubscribe: {
        secret: "test-secret",
        baseUrl: "https://example.com/api",
      },
    });
    const sendWithRetry = vi
      .fn()
      .mockResolvedValue({ id: "re_3", attempts: 1 });

    await deliverNewsletterToSubscribers(
      newsletter,
      [{ userTickerId, email: "u@example.com", language: "en" }],
      [],
      cfg,
      {
        resend: {} as Resend,
        rateLimiter: mockRateLimiter(),
        sendWithRetry,
      },
    );

    expect(sendWithRetry.mock.calls[0]?.[1]).toMatchObject({
      replyTo: "replies@example.com",
      tags: [{ name: "env", value: "test" }],
    });
  });

  it("forwards operator-configured branding URLs to renderNewsletterEmail", async () => {
    // Setup
    const mediapulseSiteUrl = "https://staging.mediapulse.example";
    const hyperjumpSiteUrl = "https://staging.hyperjump.example";
    const cfg = DeliveryConfigSchema.parse({
      resendApiKey: "re_k",
      resend: { from: "from@example.com" },
      branding: { mediapulseSiteUrl, hyperjumpSiteUrl },
      unsubscribe: {
        secret: "test-secret",
        baseUrl: "https://example.com/api",
      },
    });
    const sendWithRetry = vi
      .fn()
      .mockResolvedValue({ id: "re_brand", attempts: 1 });

    // Act
    await deliverNewsletterToSubscribers(
      newsletter,
      [{ userTickerId, email: "u@example.com", language: "en" }],
      [],
      cfg,
      {
        resend: {} as Resend,
        rateLimiter: mockRateLimiter(),
        sendWithRetry,
      },
    );

    // Assert
    const renderCall = vi.mocked(renderNewsletterEmail).mock.calls[0]?.[0];
    expect(renderCall).toMatchObject({
      mediapulseSiteUrl,
      hyperjumpSiteUrl,
    });
  });

  it("records failed status when send throws", async () => {
    const sendWithRetry = vi.fn().mockRejectedValue(new Error("Resend down"));

    const { results } = await deliverNewsletterToSubscribers(
      newsletter,
      [{ userTickerId, email: "u@example.com", language: "en" }],
      [],
      baseConfig,
      {
        resend: {} as Resend,
        rateLimiter: mockRateLimiter(),
        sendWithRetry,
      },
    );

    expect(results[0]?.status).toBe("failed");
    expect(results[0]?.attempts).toBe(baseConfig.retry.maxAttempts);
  });

  it("skips the send without acquiring when the recipient claim is lost", async () => {
    const sendWithRetry = vi.fn();
    const acquire = vi.fn().mockResolvedValue(0);
    const claimRecipient = vi.fn().mockResolvedValue(false);
    const releaseRecipient = vi.fn().mockResolvedValue(undefined);

    const { results, resendMessageIds } = await deliverNewsletterToSubscribers(
      newsletter,
      [{ userTickerId, email: "u@example.com", language: "en" }],
      [],
      baseConfig,
      {
        resend: {} as Resend,
        rateLimiter: mockRateLimiter(acquire),
        sendWithRetry,
        claimRecipient,
        releaseRecipient,
      },
    );

    expect(claimRecipient).toHaveBeenCalledWith(userTickerId);
    expect(sendWithRetry).not.toHaveBeenCalled();
    expect(acquire).not.toHaveBeenCalled();
    expect(releaseRecipient).not.toHaveBeenCalled();
    expect(results[0]).toMatchObject({
      status: "skipped",
      errorCategory: "skipped_already_claimed",
    });
    expect(resendMessageIds).toEqual([]);
  });

  it("releases the claim when a claimed send fails so it can be retried", async () => {
    const sendWithRetry = vi.fn().mockRejectedValue(new Error("Resend down"));
    const claimRecipient = vi.fn().mockResolvedValue(true);
    const releaseRecipient = vi.fn().mockResolvedValue(undefined);

    const { results } = await deliverNewsletterToSubscribers(
      newsletter,
      [{ userTickerId, email: "u@example.com", language: "en" }],
      [],
      baseConfig,
      {
        resend: {} as Resend,
        rateLimiter: mockRateLimiter(),
        sendWithRetry,
        claimRecipient,
        releaseRecipient,
      },
    );

    expect(claimRecipient).toHaveBeenCalledWith(userTickerId);
    expect(sendWithRetry).toHaveBeenCalledOnce();
    expect(releaseRecipient).toHaveBeenCalledWith(userTickerId);
    expect(results[0]?.status).toBe("failed");
  });

  it("does not release the claim when a claimed send succeeds", async () => {
    const sendWithRetry = vi
      .fn()
      .mockResolvedValue({ id: "re_ok", attempts: 1 });
    const claimRecipient = vi.fn().mockResolvedValue(true);
    const releaseRecipient = vi.fn().mockResolvedValue(undefined);

    const { results } = await deliverNewsletterToSubscribers(
      newsletter,
      [{ userTickerId, email: "u@example.com", language: "en" }],
      [],
      baseConfig,
      {
        resend: {} as Resend,
        rateLimiter: mockRateLimiter(),
        sendWithRetry,
        claimRecipient,
        releaseRecipient,
      },
    );

    expect(releaseRecipient).not.toHaveBeenCalled();
    expect(results[0]?.status).toBe("success");
  });
});
