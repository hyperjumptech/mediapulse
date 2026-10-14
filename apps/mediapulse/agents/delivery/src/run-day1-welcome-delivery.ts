import type {
  Day1Welcome,
  GetDay1WelcomeResponse,
  PostDay1WelcomeBody,
  PostDeliveryRunBody,
} from "@workspace/agent-data-api-contract";
import type { LoggerLike } from "@workspace/agent-runtime";
import {
  formatDay1WelcomeEmailSubject,
  renderNewsletterEmail,
  type RenderNewsletterEmailInput,
} from "@workspace/email-templates";
import { formatResendSender } from "@workspace/utils";
import type { Resend } from "resend";

import { describeSendFailure } from "./classify-resend-error.js";
import type { DeliveryConfig } from "./config-schema.js";
import type { RecipientSendResult } from "./deliver-newsletter.js";
import { buildDay1WelcomeMessageId } from "./message-id.js";
import {
  normalizeTestEmails,
  syntheticTestRecipientUserTickerId,
} from "./resolve-delivery-recipients.js";
import { aggregateRunOutcome, toDeliveryRecipientRow } from "./run-outcome.js";
import { buildSendPayload } from "./send-payload.js";
import { sendWithResendRetry, sleepMs } from "./send-with-resend-retry.js";
import {
  buildUnsubscribeLinks,
  type UnsubscribeSettings,
} from "./unsubscribe-links.js";

export type Day1WelcomeDataClient = {
  day1Welcome: {
    get: (query: { dispatchId: string }) => Promise<GetDay1WelcomeResponse>;
    create: (body: PostDay1WelcomeBody) => Promise<unknown>;
  };
  day1WelcomeClaim: {
    create: (body: { dispatchId: string }) => Promise<{ claimed: boolean }>;
  };
  day1WelcomeClaimRelease: {
    create: (body: { dispatchId: string }) => Promise<{ released: boolean }>;
  };
  deliveryRun: {
    create: (body: PostDeliveryRunBody) => Promise<unknown>;
  };
};

export type HermesRunFields = Pick<
  PostDeliveryRunBody,
  | "scheduleExecutionId"
  | "pipelineStepId"
  | "hermesScheduleId"
  | "hermesExecutionId"
  | "jobId"
>;

export type RunDay1WelcomeDeliveryOptions = {
  runId: string;
  startedAt: number;
  input: { tickerId: string; day1DispatchId: string; emails?: string[] };
  config: DeliveryConfig & { unsubscribe: UnsubscribeSettings };
  hermesRunFields: HermesRunFields;
};

export type RunDay1WelcomeDeliveryDependencies = {
  dataApiClient: Day1WelcomeDataClient;
  resend: Resend;
  logger: LoggerLike;
  report: (
    title: string,
    description?: string,
    status?: "processing" | "completed",
  ) => void;
  sendWithRetry?: typeof sendWithResendRetry;
  renderEmail?: typeof renderNewsletterEmail;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
};

export type Day1WelcomeDeliveryResult = {
  success: boolean;
  message: string;
  details: { outcome: PostDeliveryRunBody["outcome"]; runId: string };
};

type WelcomeRecipient = { userTickerId: string; email: string };

export const DAY1_WELCOME_RUN_AGENT_ID = "delivery-day1-welcome";

const RECORD_WELCOME_ATTEMPTS = 3;
const RECORD_WELCOME_RETRY_DELAY_MS = 1_000;

export const buildDay1WelcomeRenderInput = (
  welcome: Day1Welcome,
  unsubscribeUrl: string,
  template: DeliveryConfig["template"],
): RenderNewsletterEmailInput => {
  const reviewTimeLabel = template.reviewTimeLabels?.[welcome.language];

  return {
    variant: "day1-welcome",
    tickerSymbol: welcome.tickerSymbol,
    companyName: welcome.companyName,
    language: welcome.language,
    ...(reviewTimeLabel !== undefined ? { reviewTimeLabel } : {}),
    ...(welcome.overview !== null ? { overview: welcome.overview } : {}),
    ...(welcome.businessOperation !== null
      ? { businessOperation: welcome.businessOperation }
      : {}),
    classification: welcome.classification,
    competitors: welcome.competitors,
    regulators: welcome.regulators,
    recentStories: welcome.recentStories,
    unsubscribeUrl,
  };
};

const resolveWelcomeRecipients = (
  welcome: Day1Welcome,
  testEmails: string[] | undefined,
): WelcomeRecipient[] => {
  if (testEmails !== undefined) {
    const subscriberEmail = welcome.recipient?.email.trim().toLowerCase();

    return normalizeTestEmails(testEmails).map((email) => ({
      userTickerId:
        email === subscriberEmail
          ? welcome.userTickerId
          : syntheticTestRecipientUserTickerId(email),
      email,
    }));
  }

  return welcome.recipient === null
    ? []
    : [{ userTickerId: welcome.userTickerId, email: welcome.recipient.email }];
};

const releaseClaimQuietly = async (
  dataApiClient: Day1WelcomeDataClient,
  logger: LoggerLike,
  dispatchId: string,
): Promise<void> => {
  try {
    await dataApiClient.day1WelcomeClaimRelease.create({ dispatchId });
  } catch (releaseError) {
    logger.error?.(
      { dispatchId, err: releaseError },
      "day-1 welcome claim release failed",
    );
  }
};

const recordWelcomeSent = async (
  dataApiClient: Day1WelcomeDataClient,
  logger: LoggerLike,
  sleep: (milliseconds: number) => Promise<void>,
  body: PostDay1WelcomeBody,
): Promise<boolean> => {
  for (let attempt = 1; attempt <= RECORD_WELCOME_ATTEMPTS; attempt += 1) {
    try {
      await dataApiClient.day1Welcome.create(body);

      return true;
    } catch (recordError) {
      logger.error?.(
        { dispatchId: body.dispatchId, attempt, err: recordError },
        "day-1 welcome record failed",
      );
      if (attempt < RECORD_WELCOME_ATTEMPTS) {
        await sleep(RECORD_WELCOME_RETRY_DELAY_MS * attempt);
      }
    }
  }

  return false;
};

type SendWelcomeToRecipientsInput = {
  welcome: Day1Welcome;
  recipients: WelcomeRecipient[];
  dispatchId: string;
  config: RunDay1WelcomeDeliveryOptions["config"];
  results: RecipientSendResult[];
  resendMessageIds: string[];
  dependencies: {
    resend: Resend;
    logger: LoggerLike;
    sendWithRetry: typeof sendWithResendRetry;
    renderEmail: typeof renderNewsletterEmail;
  };
};

const sendWelcomeToRecipients = async ({
  welcome,
  recipients,
  dispatchId,
  config,
  results,
  resendMessageIds,
  dependencies: { resend, logger, sendWithRetry, renderEmail },
}: SendWelcomeToRecipientsInput): Promise<void> => {
  const from = formatResendSender(config.resend.from);
  const subject = formatDay1WelcomeEmailSubject({
    tickerSymbol: welcome.tickerSymbol,
    companyName: welcome.companyName,
    language: welcome.language,
  });
  for (const recipient of recipients) {
    const { unsubscribeUrl, oneClickUnsubscribeUrl } = buildUnsubscribeLinks({
      userTickerId: recipient.userTickerId,
      tickerSymbol: welcome.tickerSymbol,
      language: welcome.language,
      settings: config.unsubscribe,
    });
    const renderInput = buildDay1WelcomeRenderInput(
      welcome,
      unsubscribeUrl,
      config.template,
    );
    try {
      const { html, text } = await renderEmail(renderInput);
      const payload = buildSendPayload({
        config,
        from,
        to: recipient.email,
        subject,
        html,
        text,
        oneClickUnsubscribeUrl,
        messageId: buildDay1WelcomeMessageId(
          dispatchId,
          recipient.userTickerId,
          from,
        ),
      });
      const { id, attempts } = await sendWithRetry(
        resend,
        payload,
        config.retry,
      );
      if (id) {
        resendMessageIds.push(id);
      }
      results.push({
        userTickerId: recipient.userTickerId,
        status: "success",
        attempts,
        resendEmailId: id,
      });
    } catch (error) {
      const failure = describeSendFailure(error, config.retry.maxAttempts);
      logger.error?.(
        {
          dispatchId,
          err: error,
          errorCategory: failure.errorCategory,
          resendErrorName: failure.resendErrorName,
        },
        "day-1 welcome send failed",
      );
      results.push({
        userTickerId: recipient.userTickerId,
        status: "failed",
        attempts: failure.attempts,
        lastErrorCode: failure.lastErrorCode,
        lastErrorMessage: failure.lastErrorMessage,
        errorCategory: failure.errorCategory,
      });
    }
  }
};

type WelcomeRunProgress = {
  stage: NonNullable<PostDeliveryRunBody["stage"]>;
  recorded: boolean;
};

type WelcomeRunRecord = Pick<PostDeliveryRunBody, "outcome" | "stage"> & {
  results: RecipientSendResult[];
  runSkipReason?: string;
  resendMessageIds?: string[];
  recipientErrorSummary?: string | null;
};

const buildWelcomeRunBody = (
  { runId, input, hermesRunFields }: RunDay1WelcomeDeliveryOptions,
  durationMs: number,
  run: WelcomeRunRecord,
): PostDeliveryRunBody => ({
  id: runId,
  agentId: DAY1_WELCOME_RUN_AGENT_ID,
  agentVersion: "1.0.0",
  tickerId: input.tickerId,
  newsletterId: null,
  outcome: run.outcome,
  stage: run.stage,
  successCount: run.results.filter((row) => row.status === "success").length,
  failureCount: run.results.filter((row) => row.status === "failed").length,
  skippedCount: run.results.filter((row) => row.status === "skipped").length,
  durationMs,
  ...hermesRunFields,
  resendMessageIds: run.resendMessageIds ?? [],
  recipientErrorSummary: run.recipientErrorSummary ?? null,
  runSkipReason: run.runSkipReason ?? null,
  recipients: run.results.map(toDeliveryRecipientRow),
});

const deliverDay1Welcome = async (
  options: RunDay1WelcomeDeliveryOptions,
  dependencies: RunDay1WelcomeDeliveryDependencies,
  progress: WelcomeRunProgress,
): Promise<Day1WelcomeDeliveryResult> => {
  const { runId, startedAt, input, config } = options;
  const {
    dataApiClient,
    resend,
    logger,
    report,
    sendWithRetry = sendWithResendRetry,
    renderEmail = renderNewsletterEmail,
    now = Date.now,
    sleep = sleepMs,
  } = dependencies;
  const dispatchId = input.day1DispatchId;
  const isTestEmailOverride = input.emails !== undefined;
  const recordRun = async (run: WelcomeRunRecord) => {
    await dataApiClient.deliveryRun.create(
      buildWelcomeRunBody(options, now() - startedAt, run),
    );
    progress.recorded = true;
  };
  const skipRun = async (
    runSkipReason: string,
    message: string,
    results: RecipientSendResult[] = [],
    outcome: PostDeliveryRunBody["outcome"] = "skipped",
  ): Promise<Day1WelcomeDeliveryResult> => {
    logger.info?.(
      { tickerId: input.tickerId, runId, dispatchId, runSkipReason },
      "day-1 welcome skipped",
    );
    await recordRun({ outcome, stage: "fetch", results, runSkipReason });
    report("Welcome skipped", message, "completed");

    return { success: true, message, details: { outcome, runId } };
  };

  report("Fetching day-1 welcome", `dispatch ${dispatchId}`);
  const { welcome } = await dataApiClient.day1Welcome.get({ dispatchId });
  if (welcome === null || welcome.tickerId !== input.tickerId) {
    return skipRun(
      "skipped_welcome_not_found",
      "Skipped: no welcome dispatch for this ticker",
    );
  }
  if (welcome.sentAt !== null && !isTestEmailOverride) {
    return skipRun(
      "skipped_welcome_already_sent",
      "Skipped: welcome already sent",
    );
  }
  const recipients = resolveWelcomeRecipients(welcome, input.emails);
  if (recipients.length === 0) {
    return isTestEmailOverride
      ? skipRun(
          "skipped_no_test_recipients",
          "Skipped: no test recipient emails",
        )
      : skipRun(
          "skipped_no_subscribers",
          "Skipped: subscriber is no longer active",
        );
  }
  if (!isTestEmailOverride) {
    const { claimed } = await dataApiClient.day1WelcomeClaim.create({
      dispatchId,
    });
    if (!claimed) {
      const claimLost: RecipientSendResult = {
        userTickerId: welcome.userTickerId,
        status: "skipped",
        attempts: 0,
        lastErrorMessage: "already_claimed",
        errorCategory: "skipped_already_claimed",
      };

      return skipRun(
        "skipped_welcome_already_claimed",
        "Skipped: another run owns this welcome",
        [claimLost],
        "skipped_all_already_delivered",
      );
    }
  }

  const results: RecipientSendResult[] = [];
  const resendMessageIds: string[] = [];
  let recordSummary: string | null = null;
  try {
    progress.stage = "send";
    report("Sending welcome", `${recipients.length} recipient(s) via Resend`);
    await sendWelcomeToRecipients({
      welcome,
      recipients,
      dispatchId,
      config,
      results,
      resendMessageIds,
      dependencies: { resend, logger, sendWithRetry, renderEmail },
    });
  } catch (error) {
    if (!isTestEmailOverride) {
      await releaseClaimQuietly(dataApiClient, logger, dispatchId);
    }
    throw error;
  }
  progress.stage = "persist_delivery_record";
  const [sent] = results;
  if (!isTestEmailOverride && sent !== undefined) {
    if (sent.status === "success") {
      const recorded = await recordWelcomeSent(dataApiClient, logger, sleep, {
        dispatchId,
        ...(sent.resendEmailId !== undefined
          ? { resendEmailId: sent.resendEmailId }
          : {}),
      });
      recordSummary = recorded ? null : "welcome_sent_but_not_recorded";
    } else {
      await releaseClaimQuietly(dataApiClient, logger, dispatchId);
    }
  }

  const outcome = aggregateRunOutcome(results);
  await recordRun({
    outcome,
    stage: "persist_delivery_record",
    results,
    resendMessageIds,
    recipientErrorSummary:
      results.find((row) => row.status === "failed")?.lastErrorMessage ??
      recordSummary,
  });
  logger.info?.(
    {
      tickerId: input.tickerId,
      runId,
      dispatchId,
      outcome,
      ...(isTestEmailOverride ? { testEmailOverride: true } : {}),
    },
    "day-1 welcome outcome",
  );
  report("Welcome complete", outcome, "completed");

  return {
    success: outcome !== "failed",
    message:
      outcome === "failed" ? "Welcome delivery failed" : "Welcome delivered",
    details: { outcome, runId },
  };
};

export const runDay1WelcomeDelivery = async (
  options: RunDay1WelcomeDeliveryOptions,
  dependencies: RunDay1WelcomeDeliveryDependencies,
): Promise<Day1WelcomeDeliveryResult> => {
  const progress: WelcomeRunProgress = { stage: "fetch", recorded: false };
  try {
    return await deliverDay1Welcome(options, dependencies, progress);
  } catch (error) {
    const { logger, dataApiClient, now = Date.now } = dependencies;
    const message = error instanceof Error ? error.message : String(error);
    logger.error?.(
      { err: error, dispatchId: options.input.day1DispatchId },
      "day-1 welcome run failed",
    );
    if (progress.recorded) {
      throw error;
    }
    try {
      await dataApiClient.deliveryRun.create(
        buildWelcomeRunBody(options, now() - options.startedAt, {
          outcome: "failed",
          stage: progress.stage,
          results: [],
          recipientErrorSummary: message.slice(0, 500),
        }),
      );
    } catch (persistError) {
      logger.error?.(
        { err: persistError },
        "Failed to persist day-1 welcome run diagnostics",
      );
    }
    throw error;
  }
};
