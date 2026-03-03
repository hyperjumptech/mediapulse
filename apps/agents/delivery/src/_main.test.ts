import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TICKER_ID = "11111111-1111-4111-a111-111111111111";
const AUTH_HEADERS = { Authorization: "Bearer test-token" };

vi.mock("@workspace/agent-auth-client", () => ({
  verifyTokenViaAuthApi: vi.fn().mockResolvedValue(true),
}));

vi.mock("@workspace/env/agents-delivery", () => ({
  env: {
    AGENT_DATA_API_URL: "http://agent-data-api",
    AGENT_AUTH_API_URL: "http://agent-auth-api",
  },
}));

vi.mock("got", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("./send-email-to-users.js", () => ({
  sendEmailToUsers: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./send-to-agent-data-api.js", () => ({
  sendToAgentDataAPI: vi.fn().mockResolvedValue(undefined),
}));

const getGot = async () => (await import("got")).default;
const getSendEmail = async () =>
  (await import("./send-email-to-users.js")).sendEmailToUsers;

describe("delivery-agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 and success when delivery is successful", async () => {
    const got = await getGot();
    (got.get as any).mockResolvedValue({
      ok: true,
      statusCode: 200,
      body: JSON.stringify({
        newsletter: { subject: "News", content: "Body" },
        subscribers: [{ email: "u@example.com" }],
      }),
    });

    const { default: agent } = await import("./_main.js");
    const res = await agent.fetch(
      new Request("http://localhost/", {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ tickerId: TICKER_ID }),
      }),
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.agentId).toBe("delivery");
    expect(got.get).toHaveBeenCalled();
    const sendEmail = await getSendEmail();
    expect(sendEmail).toHaveBeenCalled();
  });

  it("returns 500 when no newsletter is found", async () => {
    const got = await getGot();
    (got.get as any).mockResolvedValue({
      ok: false,
      statusCode: 404,
    });

    const { default: agent } = await import("./_main.js");
    const res = await agent.fetch(
      new Request("http://localhost/", {
        method: "POST",
        headers: { ...AUTH_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ tickerId: TICKER_ID }),
      }),
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toBe("Internal Server Error");
  });
});
