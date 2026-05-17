/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Resend } from "resend";
import {
  DEFAULT_HYPERJUMP_SITE_URL,
  DEFAULT_MEDIAPULSE_SITE_URL,
  renderNewsletterEmail,
} from "@workspace/email-templates";

import { DeliveryConfigSchema } from "./config-schema.js";
import { deliverNewsletterToSubscribers } from "./deliver-newsletter.js";

vi.mock("@workspace/email-templates", async () => {
  const actual = await vi.importActual<
    typeof import("@workspace/email-templates")
  >("@workspace/email-templates");
  return {
    ...actual,
    renderNewsletterEmail: vi.fn(),
  };
});

const newsletter = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  subject: "Subject",
  content: "Body",
  symbol: "AAPL",
} as const;

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
      [{ userTickerId, email: "u@example.com" }],
      [],
      baseConfig,
      {
        resend: {} as Resend,
        rateLimiter: { acquire },
        sendWithRetry,
        logger: { info: logInfo, error: logError },
      },
    );

    const renderCall = vi.mocked(renderNewsletterEmail).mock.calls[0]?.[0];
    expect(renderCall).toMatchObject({
      title: newsletter.subject,
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
      from: "from@example.com",
      to: "u@example.com",
      subject: newsletter.subject,
      headers: {
        "List-Unsubscribe": expect.stringContaining(
          "https://example.com/api/unsubscribe",
        ),
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
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

  it("skips checkpointed subscribers without acquire or send", async () => {
    const sendWithRetry = vi.fn();
    const acquire = vi.fn().mockResolvedValue(0);
    const logInfo = vi.fn();
    const logError = vi.fn();

    const { results, resendMessageIds } = await deliverNewsletterToSubscribers(
      newsletter,
      [{ userTickerId, email: "u@example.com" }],
      [userTickerId],
      baseConfig,
      {
        resend: {} as Resend,
        rateLimiter: { acquire },
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
      [{ userTickerId, email: "u@example.com" }],
      [],
      cfg,
      {
        resend: {} as Resend,
        rateLimiter: { acquire: vi.fn().mockResolvedValue(0) },
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
      [{ userTickerId, email: "u@example.com" }],
      [],
      cfg,
      {
        resend: {} as Resend,
        rateLimiter: { acquire: vi.fn().mockResolvedValue(0) },
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
      [{ userTickerId, email: "u@example.com" }],
      [],
      cfg,
      {
        resend: {} as Resend,
        rateLimiter: { acquire: vi.fn().mockResolvedValue(0) },
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
      [{ userTickerId, email: "u@example.com" }],
      [],
      cfg,
      {
        resend: {} as Resend,
        rateLimiter: { acquire: vi.fn().mockResolvedValue(0) },
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
      [{ userTickerId, email: "u@example.com" }],
      [],
      baseConfig,
      {
        resend: {} as Resend,
        rateLimiter: { acquire: vi.fn().mockResolvedValue(0) },
        sendWithRetry,
      },
    );

    expect(results[0]?.status).toBe("failed");
    expect(results[0]?.attempts).toBe(baseConfig.retry.maxAttempts);
  });
});
