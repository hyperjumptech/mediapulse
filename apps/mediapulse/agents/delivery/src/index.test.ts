/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  hoistedLogger,
  mockDeliverNewsletter,
  mockFetch,
  deliveryGetMock,
  deliveryCreateMock,
  deliveryRunCreateMock,
} = vi.hoisted(() => ({
  hoistedLogger: {
    info: vi.fn(),
    error: vi.fn(),
  },
  mockDeliverNewsletter: vi.fn(),
  mockFetch: vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
  deliveryGetMock: vi.fn(),
  deliveryCreateMock: vi.fn().mockResolvedValue({ message: "ok" }),
  deliveryRunCreateMock: vi.fn().mockResolvedValue({ message: "ok" }),
}));

vi.stubGlobal("fetch", mockFetch);

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
    PORT: undefined,
    AGENT_REGISTRY_URL: "http://agent-registry-api",
    AGENT_PUBLIC_URL: undefined,
    DOMAIN_INTEGRATION_API_KEY: undefined,
    DOMAIN_INTEGRATION_ID: undefined,
  },
}));

vi.mock("@workspace/agent-data-api-client", () => ({
  createAgentDataApiClient: vi.fn(() => ({
    delivery: {
      get: deliveryGetMock,
      create: deliveryCreateMock,
    },
    deliveryRun: {
      create: deliveryRunCreateMock,
    },
  })),
}));

vi.mock("./deliver-newsletter.js", () => ({
  deliverNewsletterToSubscribers: mockDeliverNewsletter,
}));

type DeliveryAgentModule = typeof import("./index.js");

let agentModulePromise: Promise<DeliveryAgentModule> | undefined;

const fetchAgent = async (init: RequestInit) => {
  agentModulePromise ??= import("./index.js");
  const { default: agent } = await agentModulePromise;
  return agent.fetch(new Request("http://localhost/", init));
};

describe("delivery-agent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    deliveryGetMock.mockReset();
    deliveryCreateMock.mockReset();
    deliveryCreateMock.mockResolvedValue({ message: "ok" });
    deliveryRunCreateMock.mockReset();
    deliveryRunCreateMock.mockResolvedValue({ message: "ok" });
    mockDeliverNewsletter.mockReset();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(new Response(null, { status: 204 }));
  });

  it("returns 200 and success when delivery is successful", async () => {
    // Setup
    deliveryGetMock.mockResolvedValue({
      newsletter: {
        id: NL_ID,
        subject: "News",
        content: "Body",
        symbol: "AAPL",
      },
      subscribers: [{ userTickerId: UT_ID, email: "u@example.com" }],
      deliveredUserTickerIds: [],
    });
    mockDeliverNewsletter.mockResolvedValue({
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

    // Act
    const res = await fetchAgent({
      method: "POST",
      headers: {
        ...AUTH_HEADERS,
        "Content-Type": "application/json",
        "X-Job-Id": "job-delivery-test",
      },
      body: JSON.stringify({
        input: { tickerId: TICKER_ID },
        config: DELIVERY_CONFIG,
      }),
    });

    // Assert
    const body = (await res.json()) as {
      schemaVersion: number;
      status: string;
      details?: { outcome?: string };
    };
    expect(res.status).toBe(200);
    expect(body.schemaVersion).toBe(1);
    expect(body.status).toBe("success");
    expect(body.details?.outcome).toBe("success");
    expect(deliveryGetMock).toHaveBeenCalled();
    expect(mockDeliverNewsletter).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalled();
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
  });

  it("returns 200 skip when no newsletter with non-UUID tickerId", async () => {
    // Setup
    deliveryGetMock.mockResolvedValue({
      newsletter: null,
      subscribers: [],
      deliveredUserTickerIds: [],
    });

    // Act
    const res = await fetchAgent({
      method: "POST",
      headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { tickerId: NON_UUID_TICKER_ID },
        config: DELIVERY_CONFIG,
      }),
    });

    // Assert
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
  });

  it("returns 200 skip when no newsletter with db: expansion tickerId", async () => {
    // Setup
    deliveryGetMock.mockResolvedValue({
      newsletter: null,
      subscribers: [],
      deliveredUserTickerIds: [],
    });

    // Act
    const res = await fetchAgent({
      method: "POST",
      headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { tickerId: EXPANSION_TICKER_ID },
        config: DELIVERY_CONFIG,
      }),
    });

    // Assert
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; message?: string };
    expect(body.status).toBe("success");
    expect(body.message).toContain("Skipped");
  });

  it("returns 200 with skipped_all_already_delivered when every recipient was skipped", async () => {
    // Setup
    deliveryGetMock.mockResolvedValue({
      newsletter: {
        id: NL_ID,
        subject: "News",
        content: "Body",
        symbol: "AAPL",
      },
      subscribers: [{ userTickerId: UT_ID, email: "u@example.com" }],
      deliveredUserTickerIds: [UT_ID],
    });
    mockDeliverNewsletter.mockResolvedValue({
      results: [
        {
          userTickerId: UT_ID,
          status: "skipped",
          attempts: 0,
        },
      ],
      resendMessageIds: [],
    });

    // Act
    const res = await fetchAgent({
      method: "POST",
      headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { tickerId: TICKER_ID },
        config: DELIVERY_CONFIG,
      }),
    });

    // Assert
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
    // Act
    const res = await fetchAgent({
      method: "POST",
      headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { tickerId: "   " },
        config: DELIVERY_CONFIG,
      }),
    });

    // Assert
    expect(res.status).toBe(400);
  });

  it("returns 400 when config validation fails", async () => {
    // Act
    const res = await fetchAgent({
      method: "POST",
      headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { tickerId: TICKER_ID },
        config: {
          ...DELIVERY_CONFIG,
          rateLimit: { minIntervalMs: -1, maxSendsPerMinute: 8 },
        },
      }),
    });

    // Assert
    expect(res.status).toBe(400);
  });
});
