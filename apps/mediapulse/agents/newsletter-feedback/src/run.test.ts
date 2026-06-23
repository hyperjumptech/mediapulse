/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRunHandler, resetMessageAttemptsForTest } from "./run.js";

vi.mock("@mediapulse/env/agents-newsletter-feedback", () => ({
  env: {
    AGENT_DATA_API_URL: "http://data-api.test",
    AGENT_AUTH_API_URL: "http://auth-api.test",
    AGENT_REGISTRY_URL: "http://registry.test",
  },
}));

// Simplify withRetry to call through immediately – no delays, no retries.
vi.mock("@workspace/utils", () => ({
  withRetry: async (fn: () => unknown) => fn(),
}));

vi.mock("@workspace/logger", () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {} },
}));

vi.mock("@mediapulse/outlook-inbox", () => ({
  createOutlookInboxClient: () => ({
    listMessages: async () => ({
      messages: [],
      pagesScanned: 0,
      messagesScanned: 0,
      drained: true,
    }),
    archiveMessage: async () => {},
    markMessageRead: vi.fn(),
    processMessages: vi.fn(),
    deleteMessage: vi.fn(),
  }),
}));

vi.mock("@workspace/agent-data-api-client", () => ({
  createAgentDataApiClient: () => ({}),
}));

const NEWSLETTER_MESSAGE_ID =
  "<nl.11111111-1111-4111-a111-111111111111.22222222-2222-4222-a222-222222222222@mediapulse>";

/**
 * Builds a fake GraphMessage. By default it is a genuine newsletter reply
 * (carries a self-describing In-Reply-To header).
 */
const makeMessage = (overrides: Record<string, unknown> = {}) => ({
  id: "msg-1",
  subject: "Re: Your AAPL newsletter",
  receivedDateTime: "2024-01-01T10:00:00Z",
  isRead: false,
  body: { content: "This was super helpful, thank you!", contentType: "text" },
  from: { emailAddress: { address: "reader@example.com", name: "Reader" } },
  internetMessageHeaders: [
    { name: "In-Reply-To", value: NEWSLETTER_MESSAGE_ID },
  ],
  ...overrides,
});

const makeListResult = (messages: ReturnType<typeof makeMessage>[]) => ({
  messages,
  pagesScanned: 1,
  messagesScanned: messages.length,
  drained: true,
});

const makeCtx = (overrides: Record<string, unknown> = {}) => ({
  input: { maxMessagesPerRun: 10 },
  token: "test-token",
  config: {
    outlook: {
      userId: "user-id",
      clientId: "cid",
      tenantId: "tenant",
      clientSecret: "secret",
    },
    model: { apiKey: "sk-test", model: "gpt-test" },
  },
  ...overrides,
});

describe("createRunHandler", () => {
  beforeEach(() => {
    resetMessageAttemptsForTest();
    vi.clearAllMocks();
  });

  it("returns zero processed when the inbox is empty", async () => {
    // Setup
    const recordCreate = vi.fn();
    const run = createRunHandler({
      createInbox: () =>
        ({
          listMessages: async () => makeListResult([]),
          archiveMessage: vi.fn(),
          markMessageRead: vi.fn(),
          processMessages: vi.fn(),
          deleteMessage: vi.fn(),
        }) as never,
      createDataApi: () =>
        ({ newsletterFeedbackRecord: { create: recordCreate } }) as never,
      classify: vi.fn(),
    });

    // Act
    const result = await run(makeCtx() as never);

    // Assert
    expect(result.success).toBe(true);
    expect(result.details?.processed).toBe(0);
    expect(recordCreate).not.toHaveBeenCalled();
  });

  it("classifies, records, and archives a genuine newsletter reply", async () => {
    // Setup
    const recordCreate = vi.fn().mockResolvedValue({
      feedbackId: "fb-1",
      created: true,
      correlated: {
        userId: "u-1",
        userTickerId: "ut-1",
        newsletterId: "news-1",
      },
    });
    const archiveMessage = vi.fn().mockResolvedValue([]);
    const classify = vi
      .fn()
      .mockResolvedValue({ sentiment: "positive", category: "praise" });
    const run = createRunHandler({
      createInbox: () =>
        ({
          listMessages: async () => makeListResult([makeMessage()]),
          archiveMessage,
          markMessageRead: vi.fn(),
          processMessages: vi.fn(),
          deleteMessage: vi.fn(),
        }) as never,
      createDataApi: () =>
        ({ newsletterFeedbackRecord: { create: recordCreate } }) as never,
      classify,
    });

    // Act
    const result = await run(makeCtx() as never);

    // Assert
    expect(classify).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "sk-test", model: "gpt-test" }),
    );
    expect(recordCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        graphMessageId: "msg-1",
        senderEmail: "reader@example.com",
        inReplyToMessageId: NEWSLETTER_MESSAGE_ID,
        sentiment: "positive",
        category: "praise",
      }),
    );
    expect(archiveMessage).toHaveBeenCalledWith("msg-1");
    expect(result.details?.results[0].status).toBe("classified_archived");
    expect(result.details?.newWatermark).toBe("2024-01-01T10:00:00.000Z");
  });

  it("skips non-newsletter mail without archiving or classifying", async () => {
    // Setup
    const recordCreate = vi.fn();
    const archiveMessage = vi.fn();
    const classify = vi.fn();
    const registrationMail = makeMessage({
      subject: "[MediaPulse] Newsletter Subscription - AAPL",
      internetMessageHeaders: [],
    });
    const run = createRunHandler({
      createInbox: () =>
        ({
          listMessages: async () => makeListResult([registrationMail]),
          archiveMessage,
          markMessageRead: vi.fn(),
          processMessages: vi.fn(),
          deleteMessage: vi.fn(),
        }) as never,
      createDataApi: () =>
        ({ newsletterFeedbackRecord: { create: recordCreate } }) as never,
      classify,
    });

    // Act
    const result = await run(makeCtx() as never);

    // Assert
    expect(classify).not.toHaveBeenCalled();
    expect(recordCreate).not.toHaveBeenCalled();
    expect(archiveMessage).not.toHaveBeenCalled();
    expect(result.details?.results[0].status).toBe("skipped_not_feedback");
  });

  it("archives a reply with no usable sender as unparseable", async () => {
    // Setup
    const recordCreate = vi.fn();
    const archiveMessage = vi.fn().mockResolvedValue([]);
    const classify = vi.fn();
    const noSender = makeMessage({ from: { emailAddress: { address: "" } } });
    const run = createRunHandler({
      createInbox: () =>
        ({
          listMessages: async () => makeListResult([noSender]),
          archiveMessage,
          markMessageRead: vi.fn(),
          processMessages: vi.fn(),
          deleteMessage: vi.fn(),
        }) as never,
      createDataApi: () =>
        ({ newsletterFeedbackRecord: { create: recordCreate } }) as never,
      classify,
    });

    // Act
    const result = await run(makeCtx() as never);

    // Assert
    expect(recordCreate).not.toHaveBeenCalled();
    expect(archiveMessage).toHaveBeenCalledWith("msg-1");
    expect(result.details?.results[0].status).toBe("archived_unparseable");
  });
});
