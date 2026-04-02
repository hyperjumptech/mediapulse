/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { sendWithResendRetry } from "./send-with-resend-retry.js";

const retry = {
  maxAttempts: 2,
  baseDelayMs: 1,
  maxDelayMs: 50,
  jitter: false,
} as const;

describe("sendWithResendRetry", () => {
  it("returns Resend id on success", async () => {
    const send = vi.fn().mockResolvedValue({
      data: { id: "re_ok" },
      error: null,
      headers: {},
    });
    const resend = {
      emails: { send },
    } as unknown as Parameters<typeof sendWithResendRetry>[0];

    const result = await sendWithResendRetry(
      resend,
      {
        from: "a@b.com",
        to: "c@d.com",
        subject: "Hi",
        html: "<p>x</p>",
        text: "x",
        tags: [{ name: "agent", value: "delivery" }],
      },
      retry,
      { sleepFn: () => Promise.resolve() },
    );

    expect(result).toEqual({ id: "re_ok", attempts: 1 });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: [{ name: "agent", value: "delivery" }],
      }),
    );
  });

  it("retries once on rate limit then succeeds", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: "slow down",
          statusCode: 429,
          name: "rate_limit_exceeded",
        },
        headers: { "retry-after": "0" },
      })
      .mockResolvedValueOnce({
        data: { id: "re_retry" },
        error: null,
        headers: {},
      });
    const resend = {
      emails: { send },
    } as unknown as Parameters<typeof sendWithResendRetry>[0];

    const result = await sendWithResendRetry(
      resend,
      {
        from: "a@b.com",
        to: "c@d.com",
        subject: "Hi",
        html: "<p>x</p>",
        text: "x",
      },
      retry,
      { sleepFn: () => Promise.resolve() },
    );

    expect(result.id).toBe("re_retry");
    expect(send).toHaveBeenCalledTimes(2);
  });
});
