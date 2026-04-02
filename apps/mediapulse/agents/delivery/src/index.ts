import { randomUUID } from "node:crypto";

import {
  deliveryRunOutcomeSchema,
  deliveryRunStageSchema,
} from "@workspace/agent-data-api-contract";
import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import {
  createAgentApp,
  type HermesInvokeCorrelation,
} from "@workspace/agent-runtime";
import { logger } from "@workspace/logger";
import { env } from "@mediapulse/env/agents-delivery";
import { Resend } from "resend";
import { z } from "zod";

import { DeliveryConfigSchema, type DeliveryConfig } from "./config-schema.js";
import {
  deliverNewsletterToSubscribers,
  type RecipientSendResult,
} from "./deliver-newsletter.js";

const BodySchema = z.object({
  tickerId: z.string().uuid(),
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
        logger.info(
          { ms: Date.now() - fetchStarted, tickerId: input.tickerId },
          "delivery data-api fetch timing",
        );

        if (!deliveryData.newsletter) {
          runOutcome = "skipped";
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
          return {
            success: true,
            message: "Skipped: no newsletter to deliver",
            details: { outcome: "skipped", runId },
          };
        }

        newsletterId = deliveryData.newsletter.id;

        if (deliveryData.subscribers.length === 0) {
          runOutcome = "skipped";
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
            recipientErrorSummary: "no_subscribers",
            runSkipReason: "skipped_no_subscribers",
            recipients: [],
          });
          return {
            success: true,
            message: "Skipped: no subscribers with email",
            details: { outcome: "skipped", runId },
          };
        }

        stage = "render";
        const resend = new Resend(config.resendApiKey);

        stage = "send";
        const sendResult = await deliverNewsletterToSubscribers(
          deliveryData.newsletter,
          deliveryData.subscribers,
          deliveryData.deliveredUserTickerIds,
          config,
          { resend, logger },
        );
        recipientRows = sendResult.results;
        resendMessageIds = sendResult.resendMessageIds;
        runOutcome = aggregateOutcome(recipientRows);

        const firstFail = recipientRows.find((r) => r.status === "failed");
        errorSummary = firstFail?.lastErrorMessage ?? null;

        stage = "persist_delivery_record";
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
            domainIntegrationId: env.DOMAIN_INTEGRATION_ID ?? "mediapulse",
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
