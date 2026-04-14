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
    DOMAIN_INTEGRATION_ID: undefined,
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
  // Resend is instantiated with `new`, so the implementation must be a regular function.
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: emailSendMock } };
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

describe("user-registration agent – watermark input validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMessagesMock.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["non-date string", "not-a-date"],
    ["date-only string", "2024-01-01"],
    ["partial datetime", "2024-01-01T00:00"],
  ])("returns 400 when watermark is %s", async (_label, watermark) => {
    const res = await post({ input: { watermark } });
    expect(res.status).toBe(400);
  });

  it("returns 200 when watermark is a valid ISO datetime string", async () => {
    const res = await post({
      input: { watermark: "2024-01-01T00:00:00.000Z" },
      config: VALID_CONFIG,
    });
    expect(res.status).toBe(200);
  });

  it("returns 200 when watermark is absent", async () => {
    const res = await post({ input: {}, config: VALID_CONFIG });
    expect(res.status).toBe(200);
  });
});

describe("user-registration agent – run loop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns success with zero processed when inbox is empty", async () => {
    listMessagesMock.mockResolvedValue([]);

    const res = await post({ input: {}, config: VALID_CONFIG });
    const body = (await res.json()) as { status: string };

    expect(res.status).toBe(200);
    expect(body.status).toBe("success");
    expect(archiveMessageMock).not.toHaveBeenCalled();
  });

  it("archives unparseable message when sender email is missing", async () => {
    listMessagesMock.mockResolvedValue([makeMessage({ from: undefined })]);

    const res = await post({ input: {}, config: VALID_CONFIG });
    const body = (await res.json()) as { status: string };

    expect(res.status).toBe(200);
    expect(body.status).toBe("success");
    expect(archiveMessageMock).toHaveBeenCalledWith("msg-1");
    expect(registerCreateMock).not.toHaveBeenCalled();
  });

  it("archives unparseable message when ticker symbol cannot be parsed", async () => {
    listMessagesMock.mockResolvedValue([
      makeMessage({
        subject: "Hello there",
        body: { content: "Please unsubscribe me.", contentType: "text" },
      }),
    ]);

    const res = await post({ input: {}, config: VALID_CONFIG });
    const body = (await res.json()) as { status: string };

    expect(res.status).toBe(200);
    expect(body.status).toBe("success");
    expect(archiveMessageMock).toHaveBeenCalledWith("msg-1");
    expect(registerCreateMock).not.toHaveBeenCalled();
  });

  it("sends invalid-ticker email and archives when ticker is unknown", async () => {
    listMessagesMock.mockResolvedValue([makeMessage()]);
    registerCreateMock.mockResolvedValue({
      tickerKnown: false,
      isNewSubscription: false,
      userTickerId: null,
    });

    const res = await post({ input: {}, config: VALID_CONFIG });
    const body = (await res.json()) as { status: string };

    expect(res.status).toBe(200);
    expect(body.status).toBe("success");
    expect(emailSendMock).toHaveBeenCalledOnce();
    expect(emailSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        subject: "Invalid Ticker Selection - MediaPulse",
      }),
    );
    expect(archiveMessageMock).toHaveBeenCalledWith("msg-1");
    expect(confirmCreateMock).not.toHaveBeenCalled();
  });

  it("sends confirmation email, calls confirm API, and archives for new subscription", async () => {
    listMessagesMock.mockResolvedValue([makeMessage()]);
    registerCreateMock.mockResolvedValue({
      tickerKnown: true,
      isNewSubscription: true,
      userTickerId: "ut-uuid-1",
    });

    const res = await post({ input: {}, config: VALID_CONFIG });
    const body = (await res.json()) as { status: string };

    expect(res.status).toBe(200);
    expect(body.status).toBe("success");
    expect(emailSendMock).toHaveBeenCalledOnce();
    expect(emailSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        subject: "Subscription Confirmed - MediaPulse",
      }),
    );
    expect(confirmCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ userTickerId: "ut-uuid-1" }),
    );
    expect(archiveMessageMock).toHaveBeenCalledWith("msg-1");
  });

  it("archives with no email when subscription already active (idempotent)", async () => {
    listMessagesMock.mockResolvedValue([makeMessage()]);
    registerCreateMock.mockResolvedValue({
      tickerKnown: true,
      isNewSubscription: false,
      userTickerId: "ut-uuid-1",
    });

    const res = await post({ input: {}, config: VALID_CONFIG });
    const body = (await res.json()) as { status: string };

    expect(res.status).toBe(200);
    expect(body.status).toBe("success");
    expect(emailSendMock).not.toHaveBeenCalled();
    expect(confirmCreateMock).not.toHaveBeenCalled();
    expect(archiveMessageMock).toHaveBeenCalledWith("msg-1");
  });

  it("archives message even if confirm API throws", async () => {
    listMessagesMock.mockResolvedValue([makeMessage()]);
    registerCreateMock.mockResolvedValue({
      tickerKnown: true,
      isNewSubscription: true,
      userTickerId: "ut-uuid-1",
    });
    confirmCreateMock.mockRejectedValue(new Error("API timeout"));

    const res = await post({ input: {}, config: VALID_CONFIG });
    const body = (await res.json()) as { status: string };

    expect(res.status).toBe(200);
    expect(body.status).toBe("success");
    expect(archiveMessageMock).toHaveBeenCalledWith("msg-1");
  });

  it("marks message as failed_retry and leaves it unarchived when register API throws", async () => {
    listMessagesMock.mockResolvedValue([makeMessage()]);
    registerCreateMock.mockRejectedValue(new Error("API timeout"));

    const res = await post({ input: {}, config: VALID_CONFIG });
    const body = (await res.json()) as { status: string };

    expect(res.status).toBe(200);
    expect(body.status).toBe("success");
    expect(archiveMessageMock).not.toHaveBeenCalled();
  });

  it("retries register once and archives when the retry succeeds", async () => {
    listMessagesMock.mockResolvedValue([makeMessage()]);
    registerCreateMock
      .mockRejectedValueOnce(new Error("Agent data API error: 503"))
      .mockResolvedValueOnce({
        tickerKnown: true,
        isNewSubscription: false,
        userTickerId: "ut-uuid-1",
      });

    const res = await post({ input: {}, config: VALID_CONFIG });
    const body = (await res.json()) as { status: string };

    expect(res.status).toBe(200);
    expect(body.status).toBe("success");
    expect(registerCreateMock).toHaveBeenCalledTimes(2);
    expect(archiveMessageMock).toHaveBeenCalledWith("msg-1");
  });

  it("does not retry register for non-retryable status codes", async () => {
    listMessagesMock.mockResolvedValue([makeMessage()]);
    registerCreateMock.mockRejectedValue(
      new Error("Agent data API error: 400"),
    );

    const res = await post({ input: {}, config: VALID_CONFIG });
    const body = (await res.json()) as { status: string };

    expect(res.status).toBe(200);
    expect(body.status).toBe("success");
    expect(registerCreateMock).toHaveBeenCalledTimes(1);
    expect(archiveMessageMock).not.toHaveBeenCalled();
  });

  it("processes multiple messages independently", async () => {
    listMessagesMock.mockResolvedValue([
      makeMessage({ id: "msg-1" }),
      makeMessage({
        id: "msg-2",
        subject: "Hello there",
        body: { content: "Please unsubscribe me.", contentType: "text" },
      }),
    ]);
    registerCreateMock.mockResolvedValue({
      tickerKnown: true,
      isNewSubscription: true,
      userTickerId: "ut-uuid-1",
    });

    const res = await post({ input: {}, config: VALID_CONFIG });
    const body = (await res.json()) as { status: string };

    expect(res.status).toBe(200);
    expect(body.status).toBe("success");
    // msg-1: valid → confirmed_archived
    expect(archiveMessageMock).toHaveBeenCalledWith("msg-1");
    expect(emailSendMock).toHaveBeenCalledOnce(); // only for msg-1
    // msg-2: unparseable → archived without register call
    expect(archiveMessageMock).toHaveBeenCalledWith("msg-2");
    expect(registerCreateMock).toHaveBeenCalledOnce(); // only for msg-1
  });
});
