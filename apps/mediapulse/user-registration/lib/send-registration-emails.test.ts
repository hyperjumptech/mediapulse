/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

const defaultTestEnv = {
  AGENT_DATA_API_URL: "http://localhost:8081",
  REGISTRATION_CONFIRM_SECRET: "test-secret",
  USER_REGISTRATION_RESEND_API_KEY: "test-key",
  USER_REGISTRATION_RESEND_FROM: "registration@example.com",
  USER_REGISTRATION_PUBLIC_URL: "https://register.example.com/",
  NEXT_PUBLIC_REGISTRATION_EMAIL: "registration@test.example",
};

const testEnv = vi.hoisted((): Record<string, string> => ({}));

vi.mock("@mediapulse/env/app-user-registration", () => ({ env: testEnv }));

import { ResendSendError } from "@workspace/utils";
import {
  sendPendingConfirmationEmailDefault,
  sendRegistrationConfirmedEmailDefault,
  type ResendEmailPayload,
} from "./send-registration-emails";

const resetTestEnv = () => {
  Object.assign(testEnv, defaultTestEnv);
};

resetTestEnv();

const pendingInput = {
  to: "alice@example.com",
  name: "Alice",
  tickerSymbol: "BBCA",
  userTickerId: "11111111-1111-4111-a111-111111111111",
};

const createFakes = (sendResult: unknown) => {
  const sentPayloads: ResendEmailPayload[] = [];
  const createResendClient = vi.fn(() => ({
    emails: {
      send: async (payload: ResendEmailPayload) => {
        sentPayloads.push(payload);

        return sendResult as never;
      },
    },
  }));
  const renderEmail = vi
    .fn()
    .mockResolvedValue({ html: "<p>Confirm</p>", text: "Confirm" });
  const log = { info: vi.fn() };

  return { sentPayloads, createResendClient, renderEmail, log };
};

describe("sendPendingConfirmationEmailDefault", () => {
  afterEach(() => {
    resetTestEnv();
    vi.restoreAllMocks();
  });

  it("sends the confirmation email from the branded sender with a confirm link", async () => {
    const fakes = createFakes({ data: { id: "email-123" }, error: null });

    await sendPendingConfirmationEmailDefault(pendingInput, fakes);

    const renderInput = fakes.renderEmail.mock.calls[0]?.[0];

    expect(fakes.createResendClient).toHaveBeenCalledWith("test-key");
    expect(fakes.sentPayloads).toEqual([
      {
        from: '"MediaPulse" <registration@example.com>',
        to: "alice@example.com",
        subject: "Confirm your MediaPulse subscription",
        html: "<p>Confirm</p>",
        text: "Confirm",
      },
    ]);
    expect(renderInput.variant).toBe("registration-pending-confirmation");
    expect(renderInput.confirmUrl).toMatch(
      /^https:\/\/register\.example\.com\/api\/confirm\?token=/,
    );
    expect(fakes.log.info).toHaveBeenLastCalledWith(
      expect.objectContaining({ resendEmailId: "email-123" }),
      "user-registration: Resend emails.send accepted",
    );
  });

  it("rejects when Resend returns an error instead of a sent email", async () => {
    const fakes = createFakes({
      data: null,
      error: {
        message: "The example.com domain is not verified.",
        name: "validation_error",
        statusCode: 403,
      },
    });

    const sending = sendPendingConfirmationEmailDefault(pendingInput, fakes);

    await expect(sending).rejects.toBeInstanceOf(ResendSendError);
    await expect(sending).rejects.toThrow(
      "Resend email send failed: The example.com domain is not verified.",
    );
    expect(fakes.log.info).not.toHaveBeenCalledWith(
      expect.anything(),
      "user-registration: Resend emails.send accepted",
    );
  });

  it("rejects without calling Resend when the API key is blank", async () => {
    testEnv.USER_REGISTRATION_RESEND_API_KEY = "   ";
    const fakes = createFakes({ data: { id: "email-123" }, error: null });

    const sending = sendPendingConfirmationEmailDefault(pendingInput, fakes);

    await expect(sending).rejects.toThrow(/USER_REGISTRATION_RESEND_API_KEY/);
    expect(fakes.createResendClient).not.toHaveBeenCalled();
  });
});

describe("sendRegistrationConfirmedEmailDefault", () => {
  afterEach(() => {
    resetTestEnv();
    vi.restoreAllMocks();
  });

  it("sends the welcome email with the contact card attached", async () => {
    const fakes = createFakes({ data: { id: "email-456" }, error: null });

    await sendRegistrationConfirmedEmailDefault(
      { to: "alice@example.com", tickerSymbol: "BBCA" },
      fakes,
    );

    const sentPayload = fakes.sentPayloads[0];

    expect(sentPayload?.subject).toBe("Subscription Confirmed - MediaPulse");
    expect(sentPayload?.attachments?.[0]?.filename).toBe("MediaPulse.vcf");
  });

  it("rejects when Resend returns an error instead of a sent email", async () => {
    const fakes = createFakes({
      data: null,
      error: { message: "API key is invalid", name: "validation_error" },
    });

    const sending = sendRegistrationConfirmedEmailDefault(
      { to: "alice@example.com", tickerSymbol: "BBCA" },
      fakes,
    );

    await expect(sending).rejects.toThrow(
      "Resend email send failed: API key is invalid",
    );
  });
});
