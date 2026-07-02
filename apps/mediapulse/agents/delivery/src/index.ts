import { randomUUID } from "node:crypto";

import {
  deliveryRunOutcomeSchema,
  deliveryRunStageSchema,
} from "@workspace/agent-data-api-contract";
import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import {
  createAgentApp,
  hermesTickerIdSchema,
  type HermesInvokeCorrelation,
} from "@workspace/agent-runtime";
import { logger } from "@workspace/logger";
import { env } from "@mediapulse/env/agents-delivery";
import { Resend } from "resend";
import { z } from "zod";

import { DeliveryConfigSchema, type DeliveryConfig } from "./config-schema.js";
import {
  deliverNewsletterToSubscribers,
  type DeliveryRunConfig,
  type RecipientSendResult,
} from "./deliver-newsletter.js";
import { resolveDeliveryRecipients } from "./resolve-delivery-recipients.js";

const BodySchema = z.object({
  tickerId: hermesTickerIdSchema,
  /** When set, send only to these addresses (manual/test); skips delivery checkpoints. */
  emails: z.array(z.string().email()).optional(),
});

type Input = z.infer<typeof BodySchema>;

type DeliveryRunOutcome = z.infer<typeof deliveryRunOutcomeSchema>;
type DeliveryRunStage = z.infer<typeof deliveryRunStageSchema>;

/**
 * Maps Hermes invoke headers to persisted delivery run correlation fields.
 *
 * @param c - Parsed correlation from `createAgentApp`, if any.
 */
function hermesRunFields(c: HermesInvokeCorrelation | undefined): {
  scheduleExecutionId: string | undefined;
  pipelineStepId: string | undefined;
  hermesScheduleId: string | undefined;
  hermesExecutionId: string | undefined;
  jobId: string | undefined;
} {
  return {
    scheduleExecutionId: c?.scheduleExecutionId,
    pipelineStepId: c?.pipelineStepId,
    hermesScheduleId: c?.scheduleId,
    hermesExecutionId: c?.executionId,
    jobId: c?.jobId,
  };
}

/**
 * Derives aggregate HTTP / diagnostics outcome from per-recipient rows.
 *
 * @param results - Recipient rows after send pass (may be empty).
 */
function aggregateOutcome(results: RecipientSendResult[]): DeliveryRunOutcome {
  if (results.length === 0) {
    return "skipped";
  }
  const success = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  if (failed > 0 && success > 0) {
    return "partial_success";
  }
  if (failed > 0) {
    return "failed";
  }
  if (success === 0 && skipped === results.length) {
    return "skipped_all_already_delivered";
  }
  return "success";
}

/**
 * Counts subscribers not yet covered by a delivery checkpoint for this newsletter.
 *
 * @param subscribers - Rows from the delivery data API (enabled subscribers with email).
 * @param deliveredUserTickerIds - User-ticker ids already checkpointed for this newsletter.
 * @returns How many subscribers are still candidates for a Resend attempt this run.
 */
function pendingRecipientCount(
  subscribers: ReadonlyArray<{ userTickerId: string }>,
  deliveredUserTickerIds: readonly string[],
): number {
  const delivered = new Set(deliveredUserTickerIds);
  return subscribers.reduce(
    (n, s) => n + (delivered.has(s.userTickerId) ? 0 : 1),
    0,
  );
}

const app = createAgentApp<
  Input,
  typeof BodySchema,
  DeliveryConfig,
  z.ZodType<DeliveryConfig>
>(
  {
    agentId: "delivery",
    agentVersion: "1.0.0",
    description:
      "Delivers the latest newsletter to Mediapulse subscribers via Resend (HTML + text, rate limits, retries).",
    inputSchema: BodySchema,
    configSchema: DeliveryConfigSchema as z.ZodType<DeliveryConfig>,
    run: async ({ input, config, token, hermesCorrelation }) => {
      const runId = randomUUID();
      const startedAt = Date.now();
      const hx = hermesRunFields(hermesCorrelation);

      const dataApiClient = createAgentDataApiClient({
        baseUrl: env.AGENT_DATA_API_URL,
        version: "v1",
        token,
      });

      const report = (
        title: string,
        description?: string,
        status: "processing" | "completed" = "processing",
      ) => {
        const jobId = hermesCorrelation?.jobId;
        if (jobId && token && env.AGENT_REGISTRY_URL) {
          void fetch(`${env.AGENT_REGISTRY_URL}/api/agent-activity`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: token,
            },
            body: JSON.stringify({ jobId, title, description, status }),
          }).catch(() => {});
        }
      };

      report("Fetching newsletter and subscribers", `ticker ${input.tickerId}`);

      let stage: DeliveryRunStage = "fetch";
      let newsletterId: string | null = null;
      let recipientRows: RecipientSendResult[] = [];
      let resendMessageIds: string[] = [];
      let runOutcome: DeliveryRunOutcome = "skipped";
      let errorSummary: string | null = null;

      try {
        const fetchStarted = Date.now();
        const deliveryData = await dataApiClient.delivery.get({
          tickerId: input.tickerId,
        });
        const { subscribers, isTestEmailOverride } = resolveDeliveryRecipients(
          input,
          deliveryData,
        );
        const deliveredUserTickerIds = isTestEmailOverride
          ? []
          : deliveryData.deliveredUserTickerIds;
        const fetchMs = Date.now() - fetchStarted;
        const subscriberCount = deliveryData.subscribers.length;
        const checkpointCount = deliveryData.deliveredUserTickerIds.length;
        const recipientCount = subscribers.length;
        const pendingRecipients = pendingRecipientCount(
          subscribers,
          deliveredUserTickerIds,
        );
        logger.info(
          {
            tickerId: input.tickerId,
            fetchMs,
            hasNewsletter: deliveryData.newsletter != null,
            ...(deliveryData.newsletter != null
              ? { newsletterId: deliveryData.newsletter.id }
              : {}),
            subscriberCount,
            checkpointCount,
            pendingRecipientCount: pendingRecipients,
            ...(isTestEmailOverride
              ? {
                  testEmailOverride: true,
                  testRecipientCount: recipientCount,
                }
              : {}),
          },
          "delivery data-api fetch summary",
        );

        report(
          "Ready to deliver",
          isTestEmailOverride
            ? `${pendingRecipients} test recipient(s)`
            : `${pendingRecipients} of ${subscriberCount} pending`,
        );

        if (!deliveryData.newsletter) {
          runOutcome = "skipped";
          logger.info(
            {
              tickerId: input.tickerId,
              runId,
              runSkipReason: "skipped_no_newsletter",
            },
            "delivery run skipped",
          );
          await dataApiClient.deliveryRun.create({
            id: runId,
            agentId: "delivery",
            agentVersion: "1.0.0",
            tickerId: input.tickerId,
            newsletterId: null,
            outcome: "skipped",
            stage: "fetch",
            successCount: 0,
            failureCount: 0,
            skippedCount: 0,
            durationMs: Date.now() - startedAt,
            ...hx,
            resendMessageIds: [],
            recipientErrorSummary: null,
            runSkipReason: "skipped_no_newsletter",
            recipients: [],
          });
          report("Delivery skipped", "no newsletter available", "completed");
          return {
            success: true,
            message: "Skipped: no newsletter to deliver",
            details: { outcome: "skipped", runId },
          };
        }

        newsletterId = deliveryData.newsletter.id;

        if (subscribers.length === 0) {
          const runSkipReason = isTestEmailOverride
            ? "skipped_no_test_recipients"
            : "skipped_no_subscribers";
          const skipMessage = isTestEmailOverride
            ? "Skipped: no test recipient emails"
            : "Skipped: no subscribers with email";
          runOutcome = "skipped";
          logger.info(
            {
              tickerId: input.tickerId,
              runId,
              newsletterId,
              runSkipReason,
              ...(isTestEmailOverride ? { testEmailOverride: true } : {}),
            },
            "delivery run skipped",
          );
          await dataApiClient.deliveryRun.create({
            id: runId,
            agentId: "delivery",
            agentVersion: "1.0.0",
            tickerId: input.tickerId,
            newsletterId,
            outcome: "skipped",
            stage: "fetch",
            successCount: 0,
            failureCount: 0,
            skippedCount: 0,
            durationMs: Date.now() - startedAt,
            ...hx,
            resendMessageIds: [],
            recipientErrorSummary: isTestEmailOverride
              ? "no_test_recipients"
              : "no_subscribers",
            runSkipReason,
            recipients: [],
          });
          report("Delivery skipped", skipMessage, "completed");
          return {
            success: true,
            message: skipMessage,
            details: { outcome: "skipped", runId },
          };
        }

        stage = "render";
        const resend = new Resend(config.resendApiKey);

        stage = "send";
        report("Sending emails", `${pendingRecipients} recipients via Resend`);
        const newsletterIdForClaim = deliveryData.newsletter.id;
        // Unsubscribe settings come from env, not Hermes config: the shared HMAC secret and
        // the user-registration app origin (confirmation page + one-click endpoint are derived).
        const runConfig: DeliveryRunConfig = {
          ...config,
          unsubscribe: {
            baseUrl: env.UNSUBSCRIBE_BASE_URL,
            secret: env.UNSUBSCRIBE_SECRET,
          },
        };
        const sendResult = await deliverNewsletterToSubscribers(
          deliveryData.newsletter,
          subscribers,
          deliveredUserTickerIds,
          runConfig,
          {
            resend,
            logger,
            // Test-email overrides never write checkpoints, so they also must not claim.
            ...(isTestEmailOverride
              ? {}
              : {
                  claimRecipient: async (userTickerId) => {
                    const { claimed } =
                      await dataApiClient.deliveryClaim.create({
                        userTickerId,
                        newsletterId: newsletterIdForClaim,
                      });

                    return claimed;
                  },
                  releaseRecipient: async (userTickerId) => {
                    await dataApiClient.deliveryClaimRelease.create({
                      userTickerId,
                      newsletterId: newsletterIdForClaim,
                    });
                  },
                }),
          },
        );
        recipientRows = sendResult.results;
        resendMessageIds = sendResult.resendMessageIds;
        runOutcome = aggregateOutcome(recipientRows);

        const firstFail = recipientRows.find((r) => r.status === "failed");
        errorSummary = firstFail?.lastErrorMessage ?? null;

        stage = "persist_delivery_record";
        if (!isTestEmailOverride) {
          for (const row of recipientRows) {
            if (row.status === "success") {
              await dataApiClient.delivery.create({
                userTickerId: row.userTickerId,
                newsletterId: deliveryData.newsletter.id,
                ...(row.resendEmailId !== undefined
                  ? { resendEmailId: row.resendEmailId }
                  : {}),
              });
            }
          }
        }

        const successCount = recipientRows.filter(
          (r) => r.status === "success",
        ).length;
        const failureCount = recipientRows.filter(
          (r) => r.status === "failed",
        ).length;
        const skippedCount = recipientRows.filter(
          (r) => r.status === "skipped",
        ).length;

        await dataApiClient.deliveryRun.create({
          id: runId,
          agentId: "delivery",
          agentVersion: "1.0.0",
          tickerId: input.tickerId,
          newsletterId,
          outcome: runOutcome,
          stage: "persist_delivery_record",
          successCount,
          failureCount,
          skippedCount,
          durationMs: Date.now() - startedAt,
          ...hx,
          resendMessageIds,
          recipientErrorSummary: errorSummary,
          recipients: recipientRows.map((r) => ({
            userTickerId: r.userTickerId,
            status: r.status,
            attempts: r.attempts,
            lastErrorCode: r.lastErrorCode ?? null,
            lastErrorMessage: r.lastErrorMessage ?? null,
            errorCategory: r.errorCategory ?? null,
            resendEmailId: r.resendEmailId ?? null,
          })),
        });

        logger.info(
          {
            tickerId: input.tickerId,
            runId,
            newsletterId,
            runOutcome,
            successCount,
            failureCount,
            skippedCount,
            ...(isTestEmailOverride ? { testEmailOverride: true } : {}),
          },
          "delivery run outcome",
        );

        report(
          "Delivery complete",
          `${successCount} sent, ${failureCount} failed, ${skippedCount} skipped`,
          "completed",
        );

        if (runOutcome === "failed") {
          return {
            success: false,
            message: "Delivery failed for all recipients",
            details: { outcome: runOutcome, runId },
          };
        }

        return {
          success: true,
          message:
            runOutcome === "partial_success"
              ? "Partial delivery: some recipients failed"
              : runOutcome === "skipped_all_already_delivered"
                ? "All recipients skipped (already delivered)"
                : "Delivery completed",
          details: { outcome: runOutcome, runId },
        };
      } catch (err) {
        logger.error({ err, tickerId: input.tickerId, stage }, "delivery run");
        try {
          await dataApiClient.deliveryRun.create({
            id: runId,
            agentId: "delivery",
            agentVersion: "1.0.0",
            tickerId: input.tickerId,
            newsletterId,
            outcome: "failed",
            stage,
            successCount: recipientRows.filter((r) => r.status === "success")
              .length,
            failureCount: recipientRows.filter((r) => r.status === "failed")
              .length,
            skippedCount: recipientRows.filter((r) => r.status === "skipped")
              .length,
            durationMs: Date.now() - startedAt,
            ...hx,
            resendMessageIds,
            recipientErrorSummary:
              err instanceof Error ? err.message.slice(0, 500) : String(err),
            recipients: recipientRows.map((r) => ({
              userTickerId: r.userTickerId,
              status: r.status,
              attempts: r.attempts,
              lastErrorCode: r.lastErrorCode ?? null,
              lastErrorMessage: r.lastErrorMessage ?? null,
              errorCategory: r.errorCategory ?? null,
              resendEmailId: r.resendEmailId ?? null,
            })),
          });
        } catch (persistErr) {
          logger.error(
            { persistErr },
            "Failed to persist delivery run diagnostics",
          );
        }
        throw err;
      }
    },
  },
  {
    authApiUrl: env.AGENT_AUTH_API_URL,
    autoRegister:
      env.AGENT_REGISTRY_URL &&
      env.DOMAIN_INTEGRATION_API_KEY &&
      env.AGENT_PUBLIC_URL
        ? {
            registryUrl: env.AGENT_REGISTRY_URL,
            domainIntegrationId: env.DOMAIN_INTEGRATION_ID,
            domainIntegrationApiKey: env.DOMAIN_INTEGRATION_API_KEY,
            agentUrl: env.AGENT_PUBLIC_URL,
          }
        : undefined,
  },
);

export default {
  port: env.PORT ?? 4003,
  fetch: app.fetch,
};
