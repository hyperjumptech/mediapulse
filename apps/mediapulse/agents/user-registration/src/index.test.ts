/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/agent-auth-client", () => ({
  verifyTokenViaAuthApi: vi.fn().mockResolvedValue(true),
}));

vi.mock("@mediapulse/env/agents-user-registration", () => ({
  env: {
    AGENT_DATA_API_URL: "http://data-api.example.com",
    AGENT_AUTH_API_URL: "http://auth.example.com",
    PORT: undefined,
    AGENT_REGISTRY_URL: undefined,
    AGENT_PUBLIC_URL: undefined,
    DOMAIN_INTEGRATION_API_KEY: undefined,
    DOMAIN_INTEGRATION_KEY: undefined,
  },
}));

const listMessagesMock = vi.fn();
const archiveMessageMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@mediapulse/outlook-inbox", () => ({
  createOutlookInboxClient: vi.fn(() => ({
    listMessages: listMessagesMock,
    archiveMessage: archiveMessageMock,
  })),
}));

const registerCreateMock = vi.fn();
const confirmCreateMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@workspace/agent-data-api-client", () => ({
  createAgentDataApiClient: vi.fn(() => ({
    userRegistrationRegister: { create: registerCreateMock },
    userRegistrationConfirm: { create: confirmCreateMock },
  })),
}));

const emailSendMock = vi.fn().mockResolvedValue({ data: { id: "email-id" } });

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: emailSendMock } };
  }),
}));

// Mock email templates to return simple strings
vi.mock("@workspace/email-templates", () => ({
  renderNewsletterEmail: vi.fn().mockResolvedValue({
    html: "<html>Mocked HTML</html>",
    text: "Mocked Text",
  }),
}));

const AUTH_HEADERS = {
  Authorization: "Bearer test-token",
  "Content-Type": "application/json",
};

const VALID_CONFIG = {
  outlookClientId: "client-id",
  outlookClientSecret: "client-secret",
  outlookTenantId: "tenant-id",
  outlookUserId: "user-id",
  resendApiKey: "re_test_key",
  resendSender: "noreply@example.com",
};

const makeMessage = (overrides: Record<string, unknown> = {}) => ({
  id: "msg-1",
  subject: "Newsletter Subscription - AAPL",
  receivedDateTime: "2024-01-01T10:00:00Z",
  isRead: false,
  body: { content: "Ticker: AAPL", contentType: "text" },
  from: { emailAddress: { address: "user@example.com", name: "User" } },
  ...overrides,
});

const post = async (body: unknown) => {
  const { app } = await import("./index.js");
  return app.request("http://localhost/", {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify(body),
  });
};

describe("user-registration agent – improved run loop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns success and new watermark for new subscription", async () => {
    const msg = makeMessage({ receivedDateTime: "2024-01-01T12:00:00Z" });
    listMessagesMock.mockResolvedValue([msg]);
    registerCreateMock.mockResolvedValue({
      tickerKnown: true,
      isNewSubscription: true,
      userTickerId: "ut-uuid-1",
    });

    const res = await post({ input: {}, config: VALID_CONFIG });
    const body = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(body.status).toBe("success");
    expect(body.details.newWatermark).toBe("2024-01-01T12:00:00Z");

    expect(emailSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("Mocked HTML"),
        text: "Mocked Text",
      }),
    );
  });

  it("updates watermark to the latest processed message", async () => {
    listMessagesMock.mockResolvedValue([
      makeMessage({ id: "msg-1", receivedDateTime: "2024-01-01T10:00:00Z" }),
      makeMessage({ id: "msg-2", receivedDateTime: "2024-01-01T11:00:00Z" }),
    ]);
    registerCreateMock.mockResolvedValue({
      tickerKnown: true,
      isNewSubscription: false,
      userTickerId: "ut-uuid-1",
    });

    const res = await post({ input: {}, config: VALID_CONFIG });
    const body = (await res.json()) as any;

    expect(body.details.newWatermark).toBe("2024-01-01T11:00:00Z");
  });

  it("handles rate limiting by leaving message unarchived", async () => {
    listMessagesMock.mockResolvedValue([
      makeMessage({
        id: "msg-1",
        from: { emailAddress: { address: "spammer@example.com" } },
      }),
      makeMessage({
        id: "msg-2",
        from: { emailAddress: { address: "spammer@example.com" } },
      }),
      makeMessage({
        id: "msg-3",
        from: { emailAddress: { address: "spammer@example.com" } },
      }),
      makeMessage({
        id: "msg-4",
        from: { emailAddress: { address: "spammer@example.com" } },
      }),
      makeMessage({
        id: "msg-5",
        from: { emailAddress: { address: "spammer@example.com" } },
      }),
      makeMessage({
        id: "msg-6",
        from: { emailAddress: { address: "spammer@example.com" } },
      }),
    ]);

    registerCreateMock.mockResolvedValue({
      tickerKnown: true,
      isNewSubscription: false,
      userTickerId: "ut-uuid-1",
    });

    const res = await post({ input: {}, config: VALID_CONFIG });
    const body = (await res.json()) as any;

    expect(body.details.processed).toBe(6);
    const failed = body.details.results.filter(
      (r: any) => r.status === "failed_retry",
    );
    expect(failed.length).toBe(1); // 6th attempt should fail (limit is 5)
    expect(archiveMessageMock).toHaveBeenCalledTimes(5);
  });
});
