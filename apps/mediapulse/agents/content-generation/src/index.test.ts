import { describe, expect, it, vi } from "vitest";

import { formatNewsletterContent } from "./format-newsletter-content.js";
import { parseNewsletterJson } from "./parse-newsletter-json.js";

// ---------------------------------------------------------------------------
// Mock dependencies before importing index.ts (which creates the app)
// ---------------------------------------------------------------------------

vi.mock("@workspace/agent-data-api-client", () => ({
  createAgentDataApiClient: vi.fn(),
}));

vi.mock("@mediapulse/env/agents-content-generation", () => ({
  env: {
    AGENT_DATA_API_URL: "http://localhost:8081",
    AGENT_AUTH_API_URL: "http://localhost:8080",
    PORT: 4002,
  },
}));

vi.mock(
  "@workspace/agent-runtime",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (importOriginal) => {
    const actual =
      await importOriginal<typeof import("@workspace/agent-runtime")>();
    // Wrap createAgentApp to skip auto-registration during tests
    const originalCreateAgentApp = actual.createAgentApp;
    return {
      ...actual,
      createAgentApp: (...args: [any, any]) => {
        const [config, options] = args;
        return originalCreateAgentApp(config, {
          ...options,
          autoRegister: undefined,
        });
      },
    };
  },
);

// Must be imported after vi.mock setup
import appModule from "./index.js";

describe("formatNewsletterContent", () => {
  it("formats executive summary and top 3 news into plain text", () => {
    // Setup
    const executiveSummary =
      "Markets rallied on strong earnings. The Fed signaled a pause. Oil prices eased.";
    const topNews = [
      {
        title: "Tech giants beat estimates",
        summary: "Q4 results exceeded expectations.",
      },
      {
        title: "Fed holds rates",
        summary: "Central bank leaves policy unchanged.",
      },
      { title: "Crude drops below $80", summary: "Supply concerns ease." },
    ];

    // Act
    const content = formatNewsletterContent(executiveSummary, topNews);

    // Assert
    expect(content).toContain("EXECUTIVE SUMMARY");
    expect(content).toContain(executiveSummary);
    expect(content).toContain("TOP 3 NEWS");
    expect(content).toContain("1. Tech giants beat estimates");
    expect(content).toContain("Q4 results exceeded expectations.");
    expect(content).toContain("2. Fed holds rates");
    expect(content).toContain("3. Crude drops below $80");
    expect(content).toContain("---");
  });

  it("trims summary and item text", () => {
    // Setup
    const executiveSummary = "  Summary with spaces.  ";
    const topNews = [{ title: "  Headline  ", summary: "  Brief.  " }];

    // Act
    const content = formatNewsletterContent(executiveSummary, topNews);

    // Assert
    expect(content).toContain("Summary with spaces.");
    expect(content).toContain("1.   Headline  ");
    expect(content).toContain("Brief.");
  });

  it("handles fewer than 3 items", () => {
    // Setup
    const topNews = [{ title: "Only one", summary: "Single item." }];

    // Act
    const content = formatNewsletterContent("Summary.", topNews);

    // Assert
    expect(content).toContain("1. Only one");
    expect(content).not.toContain("2.");
  });
});

describe("parseNewsletterJson", () => {
  it("parses valid newsletter JSON", () => {
    // Setup
    const raw = JSON.stringify({
      subject: "Daily Brief",
      executiveSummary: "Markets up.",
      topNews: [{ title: "Headline", summary: "Summary text." }],
    });

    // Act
    const result = parseNewsletterJson(raw);

    // Assert
    expect(result.subject).toBe("Daily Brief");
    expect(result.executiveSummary).toBe("Markets up.");
    expect(result.topNews).toHaveLength(1);
    expect(result.topNews?.[0]?.title).toBe("Headline");
  });

  it("throws when JSON is malformed", () => {
    // Act & Assert
    expect(() => parseNewsletterJson("not valid json")).toThrow(
      "OpenAI returned invalid JSON",
    );
  });

  it("throws when topNews item has invalid shape", () => {
    // Setup: topNews item missing required title/summary strings
    const raw = JSON.stringify({
      subject: "x",
      executiveSummary: "y",
      topNews: [{ title: 123, summary: "ok" }],
    });

    // Act & Assert
    expect(() => parseNewsletterJson(raw)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// GET /schemas endpoint integration test (fix #4)
// ---------------------------------------------------------------------------

describe("GET /schemas", () => {
  it("returns 200 with inputSchema and configSchema", async () => {
    // Act
    const request = new Request("http://localhost:4002/schemas");
    const response = await appModule.fetch(request);

    // Assert
    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("inputSchema");
    expect(body).toHaveProperty("configSchema");
  });

  it("configSchema contains all expanded config groups", async () => {
    // Act
    const request = new Request("http://localhost:4002/schemas");
    const response = await appModule.fetch(request);

    // Assert
    const body = (await response.json()) as Record<string, unknown>;
    const schemaStr = JSON.stringify(body.configSchema);

    // Verify all seven config groups are present
    expect(schemaStr).toContain("openaiApiKey");
    expect(schemaStr).toContain("openaiModel");
    expect(schemaStr).toContain("apiKey");
    expect(schemaStr).toContain("baseUrl");
    expect(schemaStr).toContain("model");
    expect(schemaStr).toContain("temperature");
    expect(schemaStr).toContain("maxTokens");
    expect(schemaStr).toContain("timeoutMs");
    expect(schemaStr).toContain("systemPrompt");
    expect(schemaStr).toContain("userPromptTemplate");
    expect(schemaStr).toContain("topNewsCount");
    expect(schemaStr).toContain("maxCharsPerSource");
    expect(schemaStr).toContain("maxTotalContextChars");
    expect(schemaStr).toContain("llmRetry");
    expect(schemaStr).toContain("maxAttempts");
    expect(schemaStr).toContain("baseDelayMs");
    expect(schemaStr).toContain("maxDelayMs");
    expect(schemaStr).toContain("jitter");
    expect(schemaStr).toContain("freshness");
    expect(schemaStr).toContain("calendar_day");
    expect(schemaStr).toContain("persistRetry");
  });

  it("inputSchema requires tickerId", async () => {
    // Act
    const request = new Request("http://localhost:4002/schemas");
    const response = await appModule.fetch(request);

    // Assert
    const body = (await response.json()) as Record<string, unknown>;
    const inputSchemaStr = JSON.stringify(body.inputSchema);
    expect(inputSchemaStr).toContain("tickerId");
  });
});
