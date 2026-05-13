/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRunHandler } from "./run.js";

vi.mock("@mediapulse/env/agents-user-registration", () => ({
  env: {
    AGENT_DATA_API_URL: "http://data-api.test",
    AGENT_AUTH_API_URL: "http://auth-api.test",
  },
}));

vi.mock("@workspace/email-templates", () => ({
  renderNewsletterEmail: vi.fn().mockResolvedValue({
    html: "<html>Test</html>",
    text: "Test text",
  }),
}));

// Simplify withRetry to call through immediately – no delays, no retries.
vi.mock("@workspace/utils", () => ({
  withRetry: async (fn: () => unknown) => fn(),
}));

vi.mock("@workspace/logger", () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {} },
}));

// Fallback mocks for default DI values that are never called in these tests.
vi.mock("@mediapulse/outlook-inbox", () => ({
  createOutlookInboxClient: () => ({
    listMessages: async () => [],
    archiveMessage: async () => {},
    processMessages: vi.fn(),
    deleteMessage: vi.fn(),
  }),
}));

vi.mock("@workspace/agent-data-api-client", () => ({
  createAgentDataApiClient: () => ({}),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: async () => ({}) };
    constructor() {}
  },
}));

/**
 * Builds a minimal fake GraphMessage for use in tests.
 *
 * @param {Record<string, unknown>} overrides - Fields to override on the base message.
 * @returns A fake message object.
 */
const makeMessage = (overrides: Record<string, unknown> = {}) => ({
  id: "msg-1",
  subject: "Newsletter Subscription - AAPL",
  receivedDateTime: "2024-01-01T10:00:00Z",
  isRead: false,
  body: { content: "Ticker: AAPL", contentType: "text" },
  from: { emailAddress: { address: "user@run-test.example", name: "User" } },
  ...overrides,
});

/**
 * Builds a minimal AgentRunContext for use in tests.
 *
 * @param {Record<string, unknown>} overrides - Fields to override on the base context.
 * @returns A fake run context.
 */
const makeCtx = (overrides: Record<string, unknown> = {}) => ({
  input: { maxMessagesPerRun: 10 },
  token: "test-token",
  config: {
    outlookClientId: "cid",
    outlookClientSecret: "secret",
    outlookTenantId: "tenant",
    outlookUserId: "user-id",
    resendApiKey: "re_test",
    resendSender: "from@test.example",
  },
  ...overrides,
});

describe("createRunHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns zero processed count when the inbox is empty", async () => {
    const registerCreate = vi.fn();
    const archiveMessage = vi.fn();

    const run = createRunHandler({
      createInbox: () => ({
        listMessages: async () => [],
        archiveMessage,
        processMessages: vi.fn(),
        deleteMessage: vi.fn(),
      }),
      ResendClient: class {
        emails = { send: vi.fn() };
        constructor() {}
      } as any,
      createDataApi: () =>
        ({
          userRegistrationRegister: { create: registerCreate },
          userRegistrationConfirm: { create: vi.fn() },
        }) as any,
    });

    const result = (await run(makeCtx() as any)) as any;

    expect(result.success).toBe(true);
    expect(result.details.processed).toBe(0);
    expect(result.details.results).toEqual([]);
    expect(registerCreate).not.toHaveBeenCalled();
    expect(archiveMessage).not.toHaveBeenCalled();
  });

  it("sends a confirmation email and archives when the subscription is new", async () => {
    const archiveMessage = vi.fn().mockResolvedValue(undefined);
    const emailSend = vi.fn().mockResolvedValue({ data: { id: "email-id" } });
    const confirmCreate = vi.fn().mockResolvedValue(undefined);

    const run = createRunHandler({
      createInbox: () => ({
        listMessages: async () => [
          makeMessage({
            from: { emailAddress: { address: "new@run-test.example" } },
          }),
        ],
        archiveMessage,
        processMessages: vi.fn(),
        deleteMessage: vi.fn(),
      }),
      ResendClient: class {
        emails = { send: emailSend };
        constructor() {}
      } as any,
      createDataApi: () =>
        ({
          userRegistrationRegister: {
            create: async () => ({
              tickerKnown: true,
              isNewSubscription: true,
              userTickerId: "ut-1",
            }),
          },
          userRegistrationConfirm: { create: confirmCreate },
        }) as any,
    });

    const result = (await run(makeCtx() as any)) as any;

    expect(result.success).toBe(true);
    expect(result.details.results[0].status).toBe("confirmed_archived");
    expect(emailSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Subscription Confirmed - MediaPulse",
      }),
    );
    expect(confirmCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userTickerId: "ut-1" }),
    );
    expect(archiveMessage).toHaveBeenCalledWith("msg-1");
  });

  it("does not confirm or archive when Resend returns an error envelope for a new subscription", async () => {
    const archiveMessage = vi.fn().mockResolvedValue(undefined);
    const emailSend = vi
      .fn()
      .mockResolvedValue({ error: { message: "Invalid API key" }, data: null });
    const confirmCreate = vi.fn().mockResolvedValue(undefined);

    const run = createRunHandler({
      createInbox: () => ({
        listMessages: async () => [
          makeMessage({
            from: { emailAddress: { address: "resend-fail@run-test.example" } },
          }),
        ],
        archiveMessage,
        processMessages: vi.fn(),
        deleteMessage: vi.fn(),
      }),
      ResendClient: class {
        emails = { send: emailSend };
        constructor() {}
      } as any,
      createDataApi: () =>
        ({
          userRegistrationRegister: {
            create: async () => ({
              tickerKnown: true,
              isNewSubscription: true,
              userTickerId: "ut-fail",
            }),
          },
          userRegistrationConfirm: { create: confirmCreate },
        }) as any,
    });

    const result = (await run(makeCtx() as any)) as any;

    expect(result.details.results[0].status).toBe("failed_retry");
    expect(confirmCreate).not.toHaveBeenCalled();
    expect(archiveMessage).not.toHaveBeenCalled();
  });

  it("passes body Name to userRegistrationRegister when present", async () => {
    const registerCreate = vi.fn().mockResolvedValue({
      tickerKnown: true,
      isNewSubscription: false,
    });
    const archiveMessage = vi.fn().mockResolvedValue(undefined);

    const run = createRunHandler({
      createInbox: () => ({
        listMessages: async () => [
          makeMessage({
            subject: "[MediaPulse] Newsletter Subscription - BBCA",
            body: {
              content: "Name: Kevin Hermawan\nTicker: BBCA",
              contentType: "text",
            },
            from: { emailAddress: { address: "k@run-test.example" } },
          }),
        ],
        archiveMessage,
        processMessages: vi.fn(),
        deleteMessage: vi.fn(),
      }),
      ResendClient: class {
        emails = { send: vi.fn() };
        constructor() {}
      } as any,
      createDataApi: () =>
        ({
          userRegistrationRegister: { create: registerCreate },
          userRegistrationConfirm: { create: vi.fn() },
        }) as any,
    });

    await run(makeCtx() as any);

    expect(registerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "k@run-test.example",
        tickerSymbol: "BBCA",
        name: "Kevin Hermawan",
      }),
    );
  });

  it("passes legacy Subscriber Name from a piped one-line body to register", async () => {
    const registerCreate = vi.fn().mockResolvedValue({
      tickerKnown: true,
      isNewSubscription: false,
    });
    const oneLineBody =
      "Ticker: AAPL  |  Subscriber Name: Kevin Hermawan  |  ---  |  Please do not modify the subject or content of this email before sending.";

    const run = createRunHandler({
      createInbox: () => ({
        listMessages: async () => [
          makeMessage({
            subject: "Newsletter Subscription - AAPL",
            body: { content: oneLineBody, contentType: "text" },
            from: { emailAddress: { address: "blob@run-test.example" } },
          }),
        ],
        archiveMessage: vi.fn().mockResolvedValue(undefined),
        processMessages: vi.fn(),
        deleteMessage: vi.fn(),
      }),
      ResendClient: class {
        emails = { send: vi.fn() };
        constructor() {}
      } as any,
      createDataApi: () =>
        ({
          userRegistrationRegister: { create: registerCreate },
          userRegistrationConfirm: { create: vi.fn() },
        }) as any,
    });

    await run(makeCtx() as any);

    expect(registerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "blob@run-test.example",
        name: "Kevin Hermawan",
        tickerSymbol: "AAPL",
      }),
    );
  });

  it("archives without Resend or confirm when subscription is already active", async () => {
    const archiveMessage = vi.fn().mockResolvedValue(undefined);
    const emailSend = vi.fn().mockResolvedValue({ data: { id: "email-id" } });
    const confirmCreate = vi.fn();

    const run = createRunHandler({
      createInbox: () => ({
        listMessages: async () => [
          makeMessage({
            from: { emailAddress: { address: "existing@run-test.example" } },
          }),
        ],
        archiveMessage,
        processMessages: vi.fn(),
        deleteMessage: vi.fn(),
      }),
      ResendClient: class {
        emails = { send: emailSend };
        constructor() {}
      } as any,
      createDataApi: () =>
        ({
          userRegistrationRegister: {
            create: async () => ({
              tickerKnown: true,
              isNewSubscription: false,
              userTickerId: "ut-existing",
            }),
          },
          userRegistrationConfirm: { create: confirmCreate },
        }) as any,
    });

    const result = (await run(makeCtx() as any)) as any;

    expect(result.details.results[0].status).toBe("acknowledged_archived");
    expect(emailSend).not.toHaveBeenCalled();
    expect(confirmCreate).not.toHaveBeenCalled();
    expect(archiveMessage).toHaveBeenCalledWith("msg-1");
  });

  it("archives without Resend or confirm when subscription changed but row was already confirmed", async () => {
    const archiveMessage = vi.fn().mockResolvedValue(undefined);
    const emailSend = vi.fn().mockResolvedValue({ data: { id: "e2" } });
    const confirmCreate = vi.fn();

    const run = createRunHandler({
      createInbox: () => ({
        listMessages: async () => [
          makeMessage({
            from: { emailAddress: { address: "reenable@run-test.example" } },
          }),
        ],
        archiveMessage,
        processMessages: vi.fn(),
        deleteMessage: vi.fn(),
      }),
      ResendClient: class {
        emails = { send: emailSend };
        constructor() {}
      } as any,
      createDataApi: () =>
        ({
          userRegistrationRegister: {
            create: async () => ({
              tickerKnown: true,
              isNewSubscription: false,
              subscriptionChanged: true,
              userTickerId: "ut-re",
            }),
          },
          userRegistrationConfirm: { create: confirmCreate },
        }) as any,
    });

    const result = (await run(makeCtx() as any)) as any;

    expect(result.details.results[0].status).toBe("acknowledged_archived");
    expect(emailSend).not.toHaveBeenCalled();
    expect(confirmCreate).not.toHaveBeenCalled();
    expect(archiveMessage).toHaveBeenCalledWith("msg-1");
  });

  it("sends an invalid-ticker email and archives when the ticker is unknown", async () => {
    const archiveMessage = vi.fn().mockResolvedValue(undefined);
    const emailSend = vi.fn().mockResolvedValue({ data: { id: "email-id" } });

    const run = createRunHandler({
      createInbox: () => ({
        listMessages: async () => [
          makeMessage({
            from: { emailAddress: { address: "badticker@run-test.example" } },
          }),
        ],
        archiveMessage,
        processMessages: vi.fn(),
        deleteMessage: vi.fn(),
      }),
      ResendClient: class {
        emails = { send: emailSend };
        constructor() {}
      } as any,
      createDataApi: () =>
        ({
          userRegistrationRegister: {
            create: async () => ({ tickerKnown: false }),
          },
          userRegistrationConfirm: { create: vi.fn() },
        }) as any,
    });

    const result = (await run(makeCtx() as any)) as any;

    expect(result.details.results[0].status).toBe("invalid_ticker_archived");
    expect(emailSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Invalid Ticker Selection - MediaPulse",
      }),
    );
    expect(archiveMessage).toHaveBeenCalledWith("msg-1");
  });

  it("archives as unparseable when the subject and body contain no ticker", async () => {
    const archiveMessage = vi.fn().mockResolvedValue(undefined);
    const registerCreate = vi.fn();

    const run = createRunHandler({
      createInbox: () => ({
        listMessages: async () => [
          makeMessage({
            subject: "Hello there",
            body: { content: "Nothing useful", contentType: "text" },
            from: { emailAddress: { address: "noticker@run-test.example" } },
          }),
        ],
        archiveMessage,
        processMessages: vi.fn(),
        deleteMessage: vi.fn(),
      }),
      ResendClient: class {
        emails = { send: vi.fn() };
        constructor() {}
      } as any,
      createDataApi: () =>
        ({
          userRegistrationRegister: { create: registerCreate },
          userRegistrationConfirm: { create: vi.fn() },
        }) as any,
    });

    const result = (await run(makeCtx() as any)) as any;

    expect(result.details.results[0].status).toBe("archived_unparseable");
    expect(registerCreate).not.toHaveBeenCalled();
    expect(archiveMessage).toHaveBeenCalledWith("msg-1");
  });

  it("rate-limits and returns failed_retry on the 6th message from the same sender", async () => {
    const archiveMessage = vi.fn().mockResolvedValue(undefined);
    // Use a timestamp-suffixed email so the module-level rate limit map stays
    // isolated from other tests in this file.
    const senderEmail = `ratelimit-${Date.now()}@run-test.example`;
    const messages = Array.from({ length: 6 }, (_, i) =>
      makeMessage({
        id: `rl-${i + 1}`,
        from: { emailAddress: { address: senderEmail } },
      }),
    );

    const run = createRunHandler({
      createInbox: () => ({
        listMessages: async () => messages,
        archiveMessage,
        processMessages: vi.fn(),
        deleteMessage: vi.fn(),
      }),
      ResendClient: class {
        emails = { send: vi.fn().mockResolvedValue({ data: { id: "e" } }) };
        constructor() {}
      } as any,
      createDataApi: () =>
        ({
          userRegistrationRegister: {
            create: async () => ({
              tickerKnown: true,
              isNewSubscription: false,
            }),
          },
          userRegistrationConfirm: { create: vi.fn() },
        }) as any,
    });

    const result = (await run(makeCtx() as any)) as any;

    const failed = result.details.results.filter(
      (r: any) => r.status === "failed_retry",
    );
    expect(failed.length).toBe(1);
    expect(archiveMessage).toHaveBeenCalledTimes(5);
  });

  it("returns failed_retry without archiving on an unexpected registration error", async () => {
    const archiveMessage = vi.fn();

    const run = createRunHandler({
      createInbox: () => ({
        listMessages: async () => [
          makeMessage({
            from: { emailAddress: { address: "error@run-test.example" } },
          }),
        ],
        archiveMessage,
        processMessages: vi.fn(),
        deleteMessage: vi.fn(),
      }),
      ResendClient: class {
        emails = { send: vi.fn() };
        constructor() {}
      } as any,
      createDataApi: () =>
        ({
          userRegistrationRegister: {
            create: async () => {
              throw new Error("API unavailable");
            },
          },
          userRegistrationConfirm: { create: vi.fn() },
        }) as any,
    });

    const result = (await run(makeCtx() as any)) as any;

    expect(result.details.results[0].status).toBe("failed_retry");
    expect(archiveMessage).not.toHaveBeenCalled();
  });

  it("sets newWatermark to the latest receivedDateTime across all processed messages", async () => {
    const archiveMessage = vi.fn().mockResolvedValue(undefined);

    const run = createRunHandler({
      createInbox: () => ({
        listMessages: async () => [
          makeMessage({
            id: "wm-1",
            receivedDateTime: "2024-01-01T10:00:00Z",
            from: { emailAddress: { address: "wm1@run-test.example" } },
          }),
          makeMessage({
            id: "wm-2",
            receivedDateTime: "2024-01-01T12:00:00Z",
            from: { emailAddress: { address: "wm2@run-test.example" } },
          }),
          makeMessage({
            id: "wm-3",
            receivedDateTime: "2024-01-01T11:00:00Z",
            from: { emailAddress: { address: "wm3@run-test.example" } },
          }),
        ],
        archiveMessage,
        processMessages: vi.fn(),
        deleteMessage: vi.fn(),
      }),
      ResendClient: class {
        emails = { send: vi.fn().mockResolvedValue({ data: { id: "e" } }) };
        constructor() {}
      } as any,
      createDataApi: () =>
        ({
          userRegistrationRegister: {
            create: async () => ({
              tickerKnown: true,
              isNewSubscription: false,
            }),
          },
          userRegistrationConfirm: { create: vi.fn() },
        }) as any,
    });

    const result = (await run(makeCtx() as any)) as any;

    expect(result.details.newWatermark).toBe("2024-01-01T12:00:00.000Z");
  });
});
