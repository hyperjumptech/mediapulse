import { describe, expect, it } from "vitest";
import {
  deliveryConfigSchema,
  deliveryInputSchema,
  deliveryOutputSchema,
} from "./delivery.js";

const UUID = "11111111-1111-4111-a111-111111111111";

describe("delivery-types", () => {
  describe("deliveryInputSchema", () => {
    it("validates a simple valid input", () => {
      const input = { tickerId: UUID };
      const result = deliveryInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("validates input with optional jobId", () => {
      const input = { tickerId: UUID, jobId: "job-123" };
      const result = deliveryInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects invalid tickerId (not UUID)", () => {
      const input = { tickerId: "not-a-uuid" };
      const result = deliveryInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects input with missing tickerId", () => {
      const input = {};
      const result = deliveryInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("deliveryConfigSchema", () => {
    it("validates a complete valid config", () => {
      const config = {
        email: {
          provider: "resend",
          apiKey: "re_123",
          fromAddress: "test@example.com",
          fromName: "Test",
          templates: {
            daily: "templates/daily.html",
            weekly: "templates/weekly.html",
          },
          retry: {
            maxAttempts: 3,
            backoff: "exponential",
            delay: 1000,
          },
          tracking: {
            openTracking: true,
            clickTracking: true,
            unsubscribeLink: true,
          },
          feedback: {
            enabled: true,
            buttonTypes: ["like", "dislike"],
            placement: "inline",
            style: "buttons",
          },
        },
        dashboard: {
          updateEndpoint: "https://example.com/api/update",
          cacheStrategy: "cache-first",
          notificationEnabled: true,
        },
        rateLimiting: {
          emailsPerMinute: 100,
          batchSize: 50,
        },
      };
      const result = deliveryConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe("deliveryOutputSchema", () => {
    it("validates a complete valid output", () => {
      const output = {
        agentId: "delivery",
        agentVersion: "1.0.0",
        tickerId: UUID,
        timestamp: new Date().toISOString(),
        executionTime: 1234,
        delivery: {
          emails: [
            {
              status: "sent",
              email: "user@example.com",
              messageId: "msg_123",
              deliveredAt: new Date().toISOString(),
            },
          ],
          dashboard: {
            updated: true,
            url: "https://example.com/report",
          },
        },
        metadata: {
          deliveryTime: 500,
        },
      };
      const result = deliveryOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it("rejects output with invalid status", () => {
      const output = {
        agentId: "delivery",
        agentVersion: "1.0.0",
        tickerId: UUID,
        timestamp: new Date().toISOString(),
        executionTime: 1234,
        delivery: {
          emails: [
            {
              status: "invalid-status",
              email: "user@example.com",
            },
          ],
          dashboard: {
            updated: true,
          },
        },
        metadata: {
          deliveryTime: 500,
        },
      };
      const result = deliveryOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });
  });
});
