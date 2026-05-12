/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoistedLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@workspace/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/logger")>();
  return {
    ...actual,
    logger: {
      ...hoistedLogger,
      warn: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      fatal: vi.fn(),
      child: vi.fn().mockReturnThis(),
    },
  };
});

const TICKER_ID = "11111111-1111-4111-a111-111111111111";
/** Non-UUID id (Hermes-style test id or slug). */
const NON_UUID_TICKER_ID = "tid-non-uuid-1";
/** Valid `db:` step-input expansion string (see `@hermes/step-input-syntax`). */
const EXPANSION_TICKER_ID = "db:ticker:id?take=100";
const NL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const UT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const AUTH_HEADERS = { Authorization: "Bearer test-token" };

/** Minimal valid Hermes step config (Resend is config-only, not env). */
const DELIVERY_CONFIG = {
  resendApiKey: "re_test_key",
  resend: { from: "sender@example.com" },
  unsubscribe: { secret: "test-secret", baseUrl: "https://example.com/api" },
};

vi.mock("@workspace/agent-auth-client", () => ({
  verifyTokenViaAuthApi: vi.fn().mockResolvedValue(true),
}));

vi.mock("@mediapulse/env/agents-delivery", () => ({
  env: {
    AGENT_DATA_API_URL: "http://agent-data-api",
    AGENT_AUTH_API_URL: "http://agent-auth-api",
    AGENT_REGISTRY_URL: "http://registry",
    AGENT_PUBLIC_URL: "http://delivery",
    DOMAIN_INTEGRATION_API_KEY: "key",
    DOMAIN_INTEGRATION_ID: "mediapulse",
  },
}));

vi.mock("got", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("./deliver-newsletter.js", () => ({
  deliverNewsletterToSubscribers: vi.fn(),
}));

const getGot = async () => (await import("got")).default;
const getDeliver = async () =>
  (await import("./deliver-newsletter.js")).deliverNewsletterToSubscribers;

describe("delivery-agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 and success when delivery is successful", async () => {
    const got = await getGot();
    (got.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      statusCode: 200,
      body: JSON.stringify({
        newsletter: {
          id: NL_ID,
          subject: "News",
          content: "Body",
          symbol: "AAPL",
        },
        subscribers: [{ userTickerId: UT_ID, email: "u@example.com" }],
        deliveredUserTickerIds: [],
      }),
    });
    (got.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ message: "ok" }),
    });

    const deliver = await getDeliver();
    vi.mocked(deliver).mockResolvedValue({
      results: [
        {
          userTickerId: UT_ID,
          status: "success",
          attempts: 1,
          resendEmailId: "re_1",
        },
      ],
      resendMessageIds: ["re_1"],
    });

    const { default: agent } = await import("./index.js");
    const res = await agent.fetch(
      new Request("http://localhost/", {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { tickerId: TICKER_ID },
          config: DELIVERY_CONFIG,
        }),
      }),
    );

    const body = (await res.json()) as {
      schemaVersion: number;
      status: string;
      details?: { outcome?: string };
    };
    expect(res.status).toBe(200);
    expect(body.schemaVersion).toBe(1);
    expect(body.status).toBe("success");
    expect(body.details?.outcome).toBe("success");
    expect(got.get).toHaveBeenCalled();
    expect(deliver).toHaveBeenCalled();
    expect(hoistedLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        tickerId: TICKER_ID,
        hasNewsletter: true,
        newsletterId: NL_ID,
        subscriberCount: 1,
        checkpointCount: 0,
        pendingRecipientCount: 1,
      }),
      "delivery data-api fetch summary",
    );
    expect(hoistedLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        tickerId: TICKER_ID,
        newsletterId: NL_ID,
        runOutcome: "success",
        successCount: 1,
        failureCount: 0,
        skippedCount: 0,
      }),
      "delivery run outcome",
    );
  }, 20_000);

  it("returns 200 skip when no newsletter with non-UUID tickerId", async () => {
    const got = await getGot();
    (got.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      statusCode: 200,
      body: JSON.stringify({
        newsletter: null,
        subscribers: [],
        deliveredUserTickerIds: [],
      }),
    });
    (got.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ message: "ok" }),
    });

    const { default: agent } = await import("./index.js");
    const res = await agent.fetch(
      new Request("http://localhost/", {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { tickerId: NON_UUID_TICKER_ID },
          config: DELIVERY_CONFIG,
        }),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; message?: string };
    expect(body.status).toBe("success");
    expect(body.message).toContain("Skipped");
    expect(hoistedLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        tickerId: NON_UUID_TICKER_ID,
        hasNewsletter: false,
        subscriberCount: 0,
        checkpointCount: 0,
        pendingRecipientCount: 0,
      }),
      "delivery data-api fetch summary",
    );
    expect(hoistedLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        tickerId: NON_UUID_TICKER_ID,
        runSkipReason: "skipped_no_newsletter",
      }),
      "delivery run skipped",
    );
  }, 20_000);

  it("returns 200 skip when no newsletter with db: expansion tickerId", async () => {
    const got = await getGot();
    (got.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      statusCode: 200,
      body: JSON.stringify({
        newsletter: null,
        subscribers: [],
        deliveredUserTickerIds: [],
      }),
    });
    (got.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ message: "ok" }),
    });

    const { default: agent } = await import("./index.js");
    const res = await agent.fetch(
      new Request("http://localhost/", {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { tickerId: EXPANSION_TICKER_ID },
          config: DELIVERY_CONFIG,
        }),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; message?: string };
    expect(body.status).toBe("success");
    expect(body.message).toContain("Skipped");
  }, 20_000);

  it("returns 200 with skipped_all_already_delivered when every recipient was skipped", async () => {
    const got = await getGot();
    (got.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      statusCode: 200,
      body: JSON.stringify({
        newsletter: {
          id: NL_ID,
          subject: "News",
          content: "Body",
          symbol: "AAPL",
        },
        subscribers: [{ userTickerId: UT_ID, email: "u@example.com" }],
        deliveredUserTickerIds: [UT_ID],
      }),
    });
    (got.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ message: "ok" }),
    });

    const deliver = await getDeliver();
    vi.mocked(deliver).mockResolvedValue({
      results: [
        {
          userTickerId: UT_ID,
          status: "skipped",
          attempts: 0,
        },
      ],
      resendMessageIds: [],
    });

    const { default: agent } = await import("./index.js");
    const res = await agent.fetch(
      new Request("http://localhost/", {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { tickerId: TICKER_ID },
          config: DELIVERY_CONFIG,
        }),
      }),
    );

    const body = (await res.json()) as {
      status: string;
      message?: string;
      details?: { outcome?: string };
    };
    expect(res.status).toBe(200);
    expect(body.status).toBe("success");
    expect(body.details?.outcome).toBe("skipped_all_already_delivered");
    expect(body.message).toContain("already delivered");
    expect(hoistedLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        tickerId: TICKER_ID,
        hasNewsletter: true,
        newsletterId: NL_ID,
        subscriberCount: 1,
        checkpointCount: 1,
        pendingRecipientCount: 0,
      }),
      "delivery data-api fetch summary",
    );
    expect(hoistedLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        runOutcome: "skipped_all_already_delivered",
        successCount: 0,
        failureCount: 0,
        skippedCount: 1,
      }),
      "delivery run outcome",
    );
  });

  it("returns 400 when tickerId is only whitespace", async () => {
    const { default: agent } = await import("./index.js");
    const res = await agent.fetch(
      new Request("http://localhost/", {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { tickerId: "   " },
          config: DELIVERY_CONFIG,
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when config validation fails", async () => {
    const { default: agent } = await import("./index.js");
    const res = await agent.fetch(
      new Request("http://localhost/", {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { tickerId: TICKER_ID },
          config: {
            ...DELIVERY_CONFIG,
            rateLimit: { minIntervalMs: -1, maxSendsPerMinute: 8 },
          },
        }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
