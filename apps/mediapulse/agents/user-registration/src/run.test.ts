/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRunHandler, resetRegistrationRateLimitsForTest } from "./run.js";

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
  buildVCard: ({ name, email }: { name: string; email: string }) =>
    `BEGIN:VCARD\r\nFN:${name}\r\nEMAIL:${email}\r\nEND:VCARD`,
  MEDIAPULSE_SENDER_NAME: "CEO (Chief Email Officer) - MediaPulse",
  formatResendSender: (address: string) =>
    address.includes("<")
      ? address
      : `"CEO (Chief Email Officer) - MediaPulse" <${address}>`,
}));

vi.mock("@workspace/logger", () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {} },
}));

// Fallback mocks for default DI values that are never called in these tests.
vi.mock("@mediapulse/outlook-inbox", () => ({
  createOutlookInboxClient: () => ({
    listMessages: async () => ({
      messages: [],
      pagesScanned: 0,
      messagesScanned: 0,
      drained: true,
    }),
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

/** Wraps messages in the ListMessagesResult shape returned by the inbox client. */
const makeListResult = (
  messages: ReturnType<typeof makeMessage>[],
  extra: {
    pagesScanned?: number;
    messagesScanned?: number;
    drained?: boolean;
  } = {},
) => ({
  messages,
  pagesScanned: extra.pagesScanned ?? 1,
  messagesScanned: extra.messagesScanned ?? messages.length,
  drained: extra.drained ?? true,
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
    resetRegistrationRateLimitsForTest();
    vi.clearAllMocks();
  });

  it("returns zero processed count when the inbox is empty", async () => {
    const registerCreate = vi.fn();
    const archiveMessage = vi.fn();

    const run = createRunHandler({
      createInbox: () => ({
        listMessages: async () => makeListResult([]),
        archiveMessage,
        markMessageRead: vi.fn(),
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
        listMessages: async () =>
          makeListResult([
            makeMessage({
              from: { emailAddress: { address: "new@run-test.example" } },
            }),
          ]),
        archiveMessage,
        markMessageRead: vi.fn(),
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
        from: '"CEO (Chief Email Officer) - MediaPulse" <from@test.example>',
        subject: "Subscription Confirmed - MediaPulse",
      }),
    );
    expect(confirmCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userTickerId: "ut-1" }),
    );
    expect(archiveMessage).toHaveBeenCalledWith("msg-1");
  });

  it("attaches a MediaPulse.vcf to the confirmation email for a new subscription", async () => {
    const emailSend = vi.fn().mockResolvedValue({ data: { id: "email-id" } });

    const run = createRunHandler({
      createInbox: () => ({
        listMessages: async () =>
          makeListResult([
            makeMessage({
              from: { emailAddress: { address: "vcf@run-test.example" } },
            }),
          ]),
        archiveMessage: vi.fn().mockResolvedValue(undefined),
        markMessageRead: vi.fn(),
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
              userTickerId: "ut-vcf",
            }),
          },
          userRegistrationConfirm: { create: vi.fn() },
        }) as any,
    });

    await run(makeCtx() as any);

    const payload = emailSend.mock.calls[0]![0] as any;
    expect(payload.attachments).toHaveLength(1);
    expect(payload.attachments[0].filename).toBe("MediaPulse.vcf");

    const decoded = Buffer.from(
      payload.attachments[0].content,
      "base64",
    ).toString("utf-8");
    expect(decoded).toContain("from@test.example");
    expect(decoded).toContain("CEO (Chief Email Officer) - MediaPulse");
  });

  it("does not confirm or archive when Resend returns an error envelope for a new subscription", async () => {
    const archiveMessage = vi.fn().mockResolvedValue(undefined);
    const emailSend = vi
      .fn()
      .mockResolvedValue({ error: { message: "Invalid API key" }, data: null });
    const confirmCreate = vi.fn().mockResolvedValue(undefined);

    const run = createRunHandler({
      createInbox: () => ({
        listMessages: async () =>
          makeListResult([
            makeMessage({
              from: {
                emailAddress: { address: "resend-fail@run-test.example" },
              },
            }),
          ]),
        archiveMessage,
        markMessageRead: vi.fn(),
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
        listMessages: async () =>
          makeListResult([
            makeMessage({
              subject: "[MediaPulse] Newsletter Subscription - BBCA",
              body: {
                content: "Name: Kevin Hermawan\nTicker: BBCA",
                contentType: "text",
              },
              from: { emailAddress: { address: "k@run-test.example" } },
            }),
          ]),
        archiveMessage,
        markMessageRead: vi.fn(),
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
        language: "en",
      }),
    );
  });

  it("passes the chosen Indonesian language to userRegistrationRegister", async () => {
    const registerCreate = vi.fn().mockResolvedValue({
      tickerKnown: true,
      isNewSubscription: false,
    });

    const run = createRunHandler({
      createInbox: () => ({
        listMessages: async () =>
          makeListResult([
            makeMessage({
              subject: "[MediaPulse] Newsletter Subscription - BBCA",
              body: {
                content:
                  "Name: Kevin Hermawan  |  Ticker: BBCA  |  Language: id  |  ---",
                contentType: "text",
              },
              from: { emailAddress: { address: "k@run-test.example" } },
            }),
          ]),
        archiveMessage: vi.fn().mockResolvedValue(undefined),
        markMessageRead: vi.fn(),
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
        language: "id",
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
        listMessages: async () =>
          makeListResult([
            makeMessage({
              subject: "Newsletter Subscription - AAPL",
              body: { content: oneLineBody, contentType: "text" },
              from: { emailAddress: { address: "blob@run-test.example" } },
            }),
          ]),
        archiveMessage: vi.fn().mockResolvedValue(undefined),
        markMessageRead: vi.fn(),
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
        listMessages: async () =>
          makeListResult([
            makeMessage({
              from: {
                emailAddress: { address: "existing@run-test.example" },
              },
            }),
          ]),
        archiveMessage,
        markMessageRead: vi.fn(),
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
        listMessages: async () =>
          makeListResult([
            makeMessage({
              from: {
                emailAddress: { address: "reenable@run-test.example" },
              },
            }),
          ]),
        archiveMessage,
        markMessageRead: vi.fn(),
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
        listMessages: async () =>
          makeListResult([
            makeMessage({
              from: {
                emailAddress: { address: "badticker@run-test.example" },
              },
            }),
          ]),
        archiveMessage,
        markMessageRead: vi.fn(),
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
        from: '"CEO (Chief Email Officer) - MediaPulse" <from@test.example>',
        subject: "Invalid Ticker Selection - MediaPulse",
      }),
    );
    expect(archiveMessage).toHaveBeenCalledWith("msg-1");
  });

  it("does not double-wrap the from when resendSender already contains a display name", async () => {
    const emailSend = vi.fn().mockResolvedValue({ data: { id: "email-id" } });

    const run = createRunHandler({
      createInbox: () => ({
        listMessages: async () =>
          makeListResult([
            makeMessage({
              from: {
                emailAddress: { address: "nowrap@run-test.example" },
              },
            }),
          ]),
        archiveMessage: vi.fn().mockResolvedValue(undefined),
        markMessageRead: vi.fn(),
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
              userTickerId: "ut-nowrap",
            }),
          },
          userRegistrationConfirm: { create: vi.fn() },
        }) as any,
    });

    const alreadyFormatted = '"Acme Newsletter" <already@example.com>';
    await run(
      makeCtx({
        config: { ...makeCtx().config, resendSender: alreadyFormatted },
      }) as any,
    );

    expect(emailSend).toHaveBeenCalledWith(
      expect.objectContaining({ from: alreadyFormatted }),
    );
  });

  it("archives as unparseable when the subject and body contain no ticker", async () => {
    const archiveMessage = vi.fn().mockResolvedValue(undefined);
    const registerCreate = vi.fn();

    const run = createRunHandler({
      createInbox: () => ({
        listMessages: async () =>
          makeListResult([
            makeMessage({
              subject: "Hello there",
              body: { content: "Nothing useful", contentType: "text" },
              from: { emailAddress: { address: "noticker@run-test.example" } },
            }),
          ]),
        archiveMessage,
        markMessageRead: vi.fn(),
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
        listMessages: async () => makeListResult(messages),
        archiveMessage,
        markMessageRead: vi.fn(),
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
        listMessages: async () =>
          makeListResult([
            makeMessage({
              from: { emailAddress: { address: "error@run-test.example" } },
            }),
          ]),
        archiveMessage,
        markMessageRead: vi.fn(),
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
        listMessages: async () =>
          makeListResult([
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
          ]),
        archiveMessage,
        markMessageRead: vi.fn(),
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

  it("drains all 12 subscription emails across two runs using the safe watermark", async () => {
    const archivedIds = new Set<string>();

    const allMessages = Array.from({ length: 12 }, (_, index) =>
      makeMessage({
        id: `drain-${index + 1}`,
        receivedDateTime: `2024-01-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
        from: {
          emailAddress: { address: `drain${index + 1}@run-test.example` },
        },
      }),
    );

    const archiveMessage = vi.fn(async (id: string) => {
      archivedIds.add(id);
      return [];
    });

    const run = createRunHandler({
      createInbox: () => ({
        listMessages: async (filter: any, options: any) => {
          const limit = options?.limit ?? allMessages.length;
          const watermarkTime =
            filter?.receivedAfter instanceof Date
              ? filter.receivedAfter.getTime()
              : 0;

          const available = allMessages.filter((msg) => {
            if (archivedIds.has(msg.id as string)) return false;
            const msgTime = new Date(msg.receivedDateTime as string).getTime();
            return msgTime >= watermarkTime;
          });

          const sorted = [...available].sort((a, b) => {
            const timeA = new Date(a.receivedDateTime as string).getTime();
            const timeB = new Date(b.receivedDateTime as string).getTime();
            return timeA - timeB;
          });

          const messages = sorted.slice(0, limit);
          return {
            messages,
            pagesScanned: 1,
            messagesScanned: available.length,
            drained: messages.length >= available.length,
          };
        },
        archiveMessage,
        markMessageRead: vi.fn(),
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

    // Run 1: no watermark — processes the 10 oldest messages
    const result1 = (await run(
      makeCtx({ input: { maxMessagesPerRun: 10 } }) as any,
    )) as any;

    expect(result1.details.processed).toBe(10);
    expect(result1.details.inboxScan.drained).toBe(false);
    expect(result1.details.newWatermark).toBe("2024-01-10T00:00:00.000Z");

    // Run 2: feed the watermark from run 1 — picks up exactly the remaining 2
    const result2 = (await run(
      makeCtx({
        input: {
          maxMessagesPerRun: 10,
          watermark: result1.details.newWatermark,
        },
      }) as any,
    )) as any;

    expect(result2.details.processed).toBe(2);
    expect(result2.details.inboxScan.drained).toBe(true);

    // All 12 archived — no gaps and no duplicates
    expect(archivedIds.size).toBe(12);
    for (let index = 1; index <= 12; index++) {
      expect(archivedIds).toContain(`drain-${index}`);
    }
  });

  it("processes the 10 oldest subscription emails when inbox has 12 and reports drained: false", async () => {
    // Setup: fake inbox with 12 messages ordered oldest to newest
    const archiveMessage = vi.fn().mockResolvedValue(undefined);

    const allMessages = Array.from({ length: 12 }, (_, index) =>
      makeMessage({
        id: `collect-${index + 1}`,
        receivedDateTime: `2024-01-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
        from: {
          emailAddress: { address: `user${index + 1}@run-test.example` },
        },
      }),
    );

    const run = createRunHandler({
      createInbox: () => ({
        // Fake listMessages that honours limit and orderBy to simulate real pagination behaviour.
        listMessages: async (_filter: any, options: any) => {
          const limit = options?.limit ?? options?.top ?? allMessages.length;
          const orderBy = options?.orderBy ?? "";
          const sorted = [...allMessages].sort((a, b) => {
            const timeA = new Date(a.receivedDateTime as string).getTime();
            const timeB = new Date(b.receivedDateTime as string).getTime();

            return orderBy.includes("asc") ? timeA - timeB : timeB - timeA;
          });
          const messages = sorted.slice(0, limit);
          return {
            messages,
            pagesScanned: 1,
            messagesScanned: allMessages.length,
            drained: messages.length < allMessages.length ? false : true,
          };
        },
        archiveMessage,
        markMessageRead: vi.fn(),
        processMessages: vi.fn(),
        deleteMessage: vi.fn(),
      }),
      ResendClient: class {
        emails = {
          send: vi.fn().mockResolvedValue({ data: { id: "e" } }),
        };
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

    const result = (await run(
      makeCtx({ input: { maxMessagesPerRun: 10 } }) as any,
    )) as any;

    // Exactly 10 processed (oldest 10 since orderBy asc)
    expect(result.details.processed).toBe(10);
    expect(archiveMessage).toHaveBeenCalledTimes(10);

    // Messages 11 and 12 were not processed
    const archivedIds: string[] = archiveMessage.mock.calls.map(
      (call: any) => call[0] as string,
    );
    expect(archivedIds).not.toContain("collect-11");
    expect(archivedIds).not.toContain("collect-12");
    for (let index = 1; index <= 10; index++) {
      expect(archivedIds).toContain(`collect-${index}`);
    }

    // Backlog surfaced explicitly
    expect(result.details.inboxScan.drained).toBe(false);
    expect(result.details.inboxScan.matchedMessages).toBe(10);
    expect(result.details.inboxScan.limit).toBe(10);
  });

  it("registers all new signups in one run despite an already-confirmed message at the head", async () => {
    const archiveMessage = vi.fn().mockResolvedValue(undefined);
    const registerCreate = vi.fn(async (payload: any) => {
      if (payload.email === "stuck@run-test.example") {
        return { tickerKnown: true, isNewSubscription: false };
      }

      return {
        tickerKnown: true,
        isNewSubscription: true,
        userTickerId: `ut-${payload.email}`,
      };
    });

    const messages = [
      makeMessage({
        id: "stuck",
        receivedDateTime: "2024-01-01T00:00:00Z",
        from: { emailAddress: { address: "stuck@run-test.example" } },
      }),
      ...Array.from({ length: 4 }, (_, index) =>
        makeMessage({
          id: `new-${index + 1}`,
          receivedDateTime: `2024-01-0${index + 2}T00:00:00Z`,
          from: {
            emailAddress: { address: `new${index + 1}@run-test.example` },
          },
        }),
      ),
    ];

    const run = createRunHandler({
      createInbox: () => ({
        listMessages: async () => makeListResult(messages),
        archiveMessage,
        markMessageRead: vi.fn(),
        processMessages: vi.fn(),
        deleteMessage: vi.fn(),
      }),
      ResendClient: class {
        emails = { send: vi.fn().mockResolvedValue({ data: { id: "e" } }) };
        constructor() {}
      } as any,
      createDataApi: () =>
        ({
          userRegistrationRegister: { create: registerCreate },
          userRegistrationConfirm: { create: vi.fn() },
        }) as any,
    });

    const result = (await run(
      makeCtx({ input: { maxMessagesPerRun: 5 } }) as any,
    )) as any;

    const confirmed = result.details.results.filter(
      (r: any) => r.status === "confirmed_archived",
    );
    const acknowledged = result.details.results.filter(
      (r: any) => r.status === "acknowledged_archived",
    );

    expect(confirmed).toHaveLength(4);
    expect(acknowledged).toHaveLength(1);
    expect(archiveMessage).toHaveBeenCalledTimes(5);
  });

  it("dead-letters a message that fails every run after maxMessageAttempts", async () => {
    const archiveMessage = vi.fn().mockResolvedValue(undefined);

    const run = createRunHandler({
      createInbox: () => ({
        listMessages: async () =>
          makeListResult([
            makeMessage({
              id: "poison",
              from: { emailAddress: { address: "poison@run-test.example" } },
            }),
          ]),
        archiveMessage,
        markMessageRead: vi.fn(),
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
              throw new Error("permanent failure");
            },
          },
          userRegistrationConfirm: { create: vi.fn() },
        }) as any,
    });

    // Runs 1–4: failed_retry, message left unarchived for retry
    for (let attempt = 1; attempt <= 4; attempt++) {
      const result = (await run(makeCtx() as any)) as any;
      expect(result.details.results[0].status).toBe("failed_retry");
    }
    expect(archiveMessage).not.toHaveBeenCalled();

    // Run 5: attempts reach the limit — dead-lettered and archived
    const final = (await run(makeCtx() as any)) as any;

    expect(final.details.results[0].status).toBe("dead_lettered");
    expect(archiveMessage).toHaveBeenCalledWith("poison");
  });
});
