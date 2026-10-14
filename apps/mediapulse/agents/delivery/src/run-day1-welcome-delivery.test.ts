/** @vitest-environment node */
import type { Day1Welcome } from "@workspace/agent-data-api-contract";
import type { Resend } from "resend";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";

import { DeliveryConfigSchema } from "./config-schema.js";
import { syntheticTestRecipientUserTickerId } from "./resolve-delivery-recipients.js";
import type { sendWithResendRetry } from "./send-with-resend-retry.js";
import {
  buildDay1WelcomeRenderInput,
  runDay1WelcomeDelivery,
  type Day1WelcomeDataClient,
  type RunDay1WelcomeDeliveryOptions,
} from "./run-day1-welcome-delivery.js";

const DISPATCH_ID = "11111111-1111-4111-8111-111111111111";
const USER_TICKER_ID = "22222222-2222-4222-8222-222222222222";
const TICKER_ID = "33333333-3333-4333-8333-333333333333";
const RUN_ID = "44444444-4444-4444-8444-444444444444";

const welcome = (overrides: Partial<Day1Welcome> = {}): Day1Welcome => ({
  dispatchId: DISPATCH_ID,
  tickerId: TICKER_ID,
  userTickerId: USER_TICKER_ID,
  language: "id",
  sentAt: null,
  recipient: { email: "reader@example.com" },
  tickerSymbol: "TLKM",
  companyName: "Telkom Indonesia",
  overview: null,
  businessOperation: null,
  classification: ["Infrastruktur", "Telekomunikasi"],
  competitors: ["Indosat"],
  regulators: ["Komdigi"],
  recentStories: [
    {
      title: "Telkom memperluas jaringan",
      url: "https://example.com/a",
      points: ["Poin satu"],
    },
  ],
  ...overrides,
});

const config = {
  ...DeliveryConfigSchema.parse({
    resendApiKey: "re_k",
    resend: { from: "ceo@mediapulse.example.com" },
    template: { reviewTimeLabels: { en: "7:00 AM WIB", id: "07.00 WIB" } },
  }),
  unsubscribe: { baseUrl: "https://register.example.com", secret: "s" },
};

const options = (
  overrides: Partial<RunDay1WelcomeDeliveryOptions["input"]> = {},
): RunDay1WelcomeDeliveryOptions => ({
  runId: RUN_ID,
  startedAt: 1_000,
  input: { tickerId: TICKER_ID, day1DispatchId: DISPATCH_ID, ...overrides },
  config,
  hermesRunFields: {
    scheduleExecutionId: "trigger-execution-1",
    pipelineStepId: undefined,
    hermesScheduleId: "trigger-1",
    hermesExecutionId: "execution-1",
    jobId: "job-1",
  },
});

const createDependencies = ({
  welcomeResponse = welcome(),
  claimed = true,
  sendWithRetry = vi
    .fn<typeof sendWithResendRetry>()
    .mockResolvedValue({ id: "re_1", attempts: 1 }),
}: {
  welcomeResponse?: Day1Welcome | null;
  claimed?: boolean;
  sendWithRetry?: Mock<typeof sendWithResendRetry>;
} = {}) => {
  const dataApiClient = {
    day1Welcome: {
      get: vi.fn().mockResolvedValue({ welcome: welcomeResponse }),
      create: vi.fn().mockResolvedValue({ message: "Success" }),
    },
    day1WelcomeClaim: { create: vi.fn().mockResolvedValue({ claimed }) },
    day1WelcomeClaimRelease: {
      create: vi.fn().mockResolvedValue({ released: true }),
    },
    deliveryRun: { create: vi.fn().mockResolvedValue({ message: "ok" }) },
  } satisfies Day1WelcomeDataClient;
  const renderEmail = vi
    .fn()
    .mockResolvedValue({ html: "<p>welcome</p>", text: "welcome" });

  return {
    dataApiClient,
    renderEmail,
    sendWithRetry,
    dependencies: {
      dataApiClient,
      resend: {} as Resend,
      logger: { info: vi.fn(), error: vi.fn() },
      report: vi.fn(),
      sendWithRetry,
      renderEmail,
      now: () => 1_250,
      sleep: vi.fn().mockResolvedValue(undefined),
    },
  };
};

describe("buildDay1WelcomeRenderInput", () => {
  it("passes the profile through and leaves out missing sections", () => {
    const input = buildDay1WelcomeRenderInput(
      welcome(),
      "https://register.example.com/unsubscribe?token=t&lang=id",
      config.template,
    );

    expect(input).toEqual({
      variant: "day1-welcome",
      tickerSymbol: "TLKM",
      companyName: "Telkom Indonesia",
      language: "id",
      reviewTimeLabel: "07.00 WIB",
      classification: ["Infrastruktur", "Telekomunikasi"],
      competitors: ["Indosat"],
      regulators: ["Komdigi"],
      recentStories: welcome().recentStories,
      unsubscribeUrl:
        "https://register.example.com/unsubscribe?token=t&lang=id",
    });
  });
});

describe("runDay1WelcomeDelivery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("claims, sends, records the welcome and writes the run", async () => {
    const { dataApiClient, renderEmail, sendWithRetry, dependencies } =
      createDependencies();

    const result = await runDay1WelcomeDelivery(options(), dependencies);

    expect(result).toEqual({
      success: true,
      message: "Welcome delivered",
      details: { outcome: "success", runId: RUN_ID },
    });
    expect(dataApiClient.day1Welcome.get).toHaveBeenCalledWith({
      dispatchId: DISPATCH_ID,
    });
    expect(dataApiClient.day1WelcomeClaim.create).toHaveBeenCalledWith({
      dispatchId: DISPATCH_ID,
    });
    expect(renderEmail.mock.calls[0]?.[0]).toMatchObject({
      variant: "day1-welcome",
      language: "id",
      unsubscribeUrl: expect.stringMatching(
        /^https:\/\/register\.example\.com\/unsubscribe\?token=.+&lang=id$/,
      ),
    });
    expect(sendWithRetry.mock.calls[0]?.[1]).toMatchObject({
      from: '"MediaPulse" <ceo@mediapulse.example.com>',
      to: "reader@example.com",
      subject: "TLKM Pulse: Mengenal Telkom Indonesia",
      html: "<p>welcome</p>",
      text: "welcome",
      headers: {
        "List-Unsubscribe": expect.stringContaining(
          "https://register.example.com/api/unsubscribe?token=",
        ),
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "Message-ID": `<d1w.${DISPATCH_ID}.${USER_TICKER_ID}@mediapulse.example.com>`,
      },
    });
    expect(dataApiClient.day1Welcome.create).toHaveBeenCalledWith({
      dispatchId: DISPATCH_ID,
      resendEmailId: "re_1",
    });
    expect(dataApiClient.day1WelcomeClaimRelease.create).not.toHaveBeenCalled();
    expect(dataApiClient.deliveryRun.create).toHaveBeenCalledWith({
      id: RUN_ID,
      agentId: "delivery-day1-welcome",
      agentVersion: "1.0.0",
      tickerId: TICKER_ID,
      newsletterId: null,
      outcome: "success",
      stage: "persist_delivery_record",
      successCount: 1,
      failureCount: 0,
      skippedCount: 0,
      durationMs: 250,
      scheduleExecutionId: "trigger-execution-1",
      pipelineStepId: undefined,
      hermesScheduleId: "trigger-1",
      hermesExecutionId: "execution-1",
      jobId: "job-1",
      resendMessageIds: ["re_1"],
      recipientErrorSummary: null,
      runSkipReason: null,
      recipients: [
        {
          userTickerId: USER_TICKER_ID,
          status: "success",
          attempts: 1,
          lastErrorCode: null,
          lastErrorMessage: null,
          errorCategory: null,
          resendEmailId: "re_1",
        },
      ],
    });
  });

  it.each([
    ["the dispatch is not a welcome", null, "skipped_welcome_not_found"],
    [
      "the dispatch belongs to another ticker",
      welcome({ tickerId: "other-ticker" }),
      "skipped_welcome_not_found",
    ],
    [
      "the welcome was already sent",
      welcome({ sentAt: "2026-10-14T01:00:00.000Z" }),
      "skipped_welcome_already_sent",
    ],
    [
      "the subscriber is no longer active",
      welcome({ recipient: null }),
      "skipped_no_subscribers",
    ],
  ])(
    "skips without claiming or sending when %s",
    async (_label, welcomeResponse, runSkipReason) => {
      const { dataApiClient, sendWithRetry, dependencies } = createDependencies(
        { welcomeResponse },
      );

      const result = await runDay1WelcomeDelivery(options(), dependencies);

      expect(result.details.outcome).toBe("skipped");
      expect(dataApiClient.day1WelcomeClaim.create).not.toHaveBeenCalled();
      expect(sendWithRetry).not.toHaveBeenCalled();
      expect(dataApiClient.deliveryRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: "skipped",
          newsletterId: null,
          runSkipReason,
          recipients: [],
        }),
      );
    },
  );

  it("skips the send when another run already claimed the welcome", async () => {
    const { dataApiClient, sendWithRetry, dependencies } = createDependencies({
      claimed: false,
    });

    const result = await runDay1WelcomeDelivery(options(), dependencies);

    expect(result.details.outcome).toBe("skipped_all_already_delivered");
    expect(sendWithRetry).not.toHaveBeenCalled();
    expect(dataApiClient.day1Welcome.create).not.toHaveBeenCalled();
    expect(dataApiClient.deliveryRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        runSkipReason: "skipped_welcome_already_claimed",
        recipients: [
          expect.objectContaining({
            userTickerId: USER_TICKER_ID,
            status: "skipped",
            errorCategory: "skipped_already_claimed",
          }),
        ],
      }),
    );
  });

  it("releases the claim and reports failure when the send fails", async () => {
    const { dataApiClient, dependencies } = createDependencies({
      sendWithRetry: vi
        .fn<typeof sendWithResendRetry>()
        .mockRejectedValue(new Error("Resend is down")),
    });

    const result = await runDay1WelcomeDelivery(options(), dependencies);

    expect(result).toEqual({
      success: false,
      message: "Welcome delivery failed",
      details: { outcome: "failed", runId: RUN_ID },
    });
    expect(dataApiClient.day1WelcomeClaimRelease.create).toHaveBeenCalledWith({
      dispatchId: DISPATCH_ID,
    });
    expect(dataApiClient.day1Welcome.create).not.toHaveBeenCalled();
    expect(dataApiClient.deliveryRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "failed",
        recipientErrorSummary: "Resend is down",
      }),
    );
  });

  it("keeps the claim and reports the send when recording the welcome keeps failing", async () => {
    const { dataApiClient, dependencies } = createDependencies();
    dataApiClient.day1Welcome.create.mockRejectedValue(
      new Error("agent-data-api 500"),
    );

    const result = await runDay1WelcomeDelivery(options(), dependencies);

    expect(result.details.outcome).toBe("success");
    expect(dataApiClient.day1Welcome.create).toHaveBeenCalledTimes(3);
    expect(dependencies.sleep).toHaveBeenCalledTimes(2);
    expect(dataApiClient.day1WelcomeClaimRelease.create).not.toHaveBeenCalled();
    expect(dataApiClient.deliveryRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "success",
        recipientErrorSummary: "welcome_sent_but_not_recorded",
      }),
    );
  });

  it("records the welcome when a retry succeeds", async () => {
    const { dataApiClient, dependencies } = createDependencies();
    dataApiClient.day1Welcome.create
      .mockRejectedValueOnce(new Error("agent-data-api 500"))
      .mockResolvedValueOnce({ message: "Success" });

    await runDay1WelcomeDelivery(options(), dependencies);

    expect(dataApiClient.day1Welcome.create).toHaveBeenCalledTimes(2);
    expect(dataApiClient.deliveryRun.create).toHaveBeenCalledWith(
      expect.objectContaining({ recipientErrorSummary: null }),
    );
  });

  it("releases the claim when building the email throws after the claim", async () => {
    const { dataApiClient, sendWithRetry, dependencies } = createDependencies({
      welcomeResponse: welcome({
        companyName: undefined as unknown as string,
      }),
    });

    await expect(
      runDay1WelcomeDelivery(options(), dependencies),
    ).rejects.toThrow();
    expect(sendWithRetry).not.toHaveBeenCalled();
    expect(dataApiClient.day1WelcomeClaimRelease.create).toHaveBeenCalledWith({
      dispatchId: DISPATCH_ID,
    });
    expect(dataApiClient.deliveryRun.create).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "failed" }),
    );
  });

  it("releases the claim when rendering fails", async () => {
    const { dataApiClient, renderEmail, sendWithRetry, dependencies } =
      createDependencies();
    renderEmail.mockRejectedValueOnce(new Error("template exploded"));

    const result = await runDay1WelcomeDelivery(options(), dependencies);

    expect(result.details.outcome).toBe("failed");
    expect(sendWithRetry).not.toHaveBeenCalled();
    expect(dataApiClient.day1WelcomeClaimRelease.create).toHaveBeenCalledOnce();
  });

  it("sends test emails without claiming or recording the welcome, even after it was sent", async () => {
    const { dataApiClient, sendWithRetry, dependencies } = createDependencies({
      welcomeResponse: welcome({ sentAt: "2026-10-14T01:00:00.000Z" }),
    });

    const result = await runDay1WelcomeDelivery(
      options({ emails: ["Tester@Example.com"] }),
      dependencies,
    );

    expect(result.details.outcome).toBe("success");
    expect(dataApiClient.day1WelcomeClaim.create).not.toHaveBeenCalled();
    expect(dataApiClient.day1Welcome.create).not.toHaveBeenCalled();
    expect(sendWithRetry.mock.calls[0]?.[1]).toMatchObject({
      to: "tester@example.com",
      headers: {
        "Message-ID": `<d1w.${DISPATCH_ID}.${syntheticTestRecipientUserTickerId("tester@example.com")}@mediapulse.example.com>`,
      },
    });
  });

  it("keeps the subscriber's real id when a test email is their own address", async () => {
    const { sendWithRetry, dependencies } = createDependencies();

    await runDay1WelcomeDelivery(
      options({ emails: ["Reader@Example.com"] }),
      dependencies,
    );

    expect(sendWithRetry.mock.calls[0]?.[1]).toMatchObject({
      to: "reader@example.com",
      headers: {
        "Message-ID": `<d1w.${DISPATCH_ID}.${USER_TICKER_ID}@mediapulse.example.com>`,
      },
    });
  });

  it("records the stage a run reached when it fails", async () => {
    const { dataApiClient, dependencies } = createDependencies({
      welcomeResponse: welcome({
        companyName: undefined as unknown as string,
      }),
    });

    await expect(
      runDay1WelcomeDelivery(options(), dependencies),
    ).rejects.toThrow();
    expect(dataApiClient.deliveryRun.create).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "failed", stage: "send" }),
    );
  });

  it("does not record the run twice when the failure comes after the run was recorded", async () => {
    const { dataApiClient, dependencies } = createDependencies();
    dependencies.report = vi.fn((title: string) => {
      if (title === "Welcome complete") {
        throw new Error("activity feed down");
      }
    });

    await expect(
      runDay1WelcomeDelivery(options(), dependencies),
    ).rejects.toThrow("activity feed down");
    expect(dataApiClient.deliveryRun.create).toHaveBeenCalledOnce();
  });

  it("records a failed run and rethrows when the data API is unreachable", async () => {
    const { dataApiClient, dependencies } = createDependencies();
    dataApiClient.day1Welcome.get.mockRejectedValueOnce(
      new Error("agent-data-api 503"),
    );

    await expect(
      runDay1WelcomeDelivery(options(), dependencies),
    ).rejects.toThrow("agent-data-api 503");
    expect(dataApiClient.deliveryRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "failed",
        stage: "fetch",
        recipientErrorSummary: "agent-data-api 503",
        recipients: [],
      }),
    );
  });
});
