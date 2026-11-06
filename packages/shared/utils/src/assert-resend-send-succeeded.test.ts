import { describe, expect, it } from "vitest";
import {
  assertResendSendSucceeded,
  readResendEmailId,
  ResendSendError,
} from "./assert-resend-send-succeeded.js";

describe("assertResendSendSucceeded", () => {
  it("throws a ResendSendError carrying the Resend error name and status code", () => {
    const result = {
      data: null,
      error: {
        message: "The mediapulse.example domain is not verified.",
        name: "validation_error",
        statusCode: 403,
      },
    };

    let thrown: unknown;
    try {
      assertResendSendSucceeded(result);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ResendSendError);
    expect((thrown as ResendSendError).message).toBe(
      "Resend email send failed: The mediapulse.example domain is not verified.",
    );
    expect((thrown as ResendSendError).resendErrorName).toBe(
      "validation_error",
    );
    expect((thrown as ResendSendError).statusCode).toBe(403);
  });

  it("does not throw when Resend accepted the email", () => {
    const result = { data: { id: "email-123" }, error: null };

    expect(() => assertResendSendSucceeded(result)).not.toThrow();
  });
});

describe("readResendEmailId", () => {
  it("returns the id Resend assigned to the email", () => {
    const result = { data: { id: "email-123" }, error: null };

    expect(readResendEmailId(result)).toBe("email-123");
  });

  it("returns undefined when the response carries no id", () => {
    expect(readResendEmailId({ data: null, error: null })).toBeUndefined();
    expect(readResendEmailId({ data: { id: 42 } })).toBeUndefined();
  });
});
