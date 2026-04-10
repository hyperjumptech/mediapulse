import { createAgentApp } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-user-registration";
import { z } from "zod";
import { createOutlookInboxClient } from "@mediapulse/outlook-inbox";
import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import { Resend } from "resend";
import { logger } from "@workspace/logger";

import {
  extractSenderEmail,
  extractTickerSymbol,
  deriveNameFromEmailLocalPart,
} from "./lib/parser.js";

/**
 * Extracts an HTTP status code from the agent-data-api-client error message shape.
 *
 * The SDK currently throws plain `Error("Agent data API error: <statusCode>")` for non-2xx
 * responses, so we parse that string to decide whether a failure is worth retrying.
 *
 * @param error - Unknown thrown value from the SDK call.
 * @returns The parsed HTTP status code, or null when not present.
 */
function getAgentDataApiStatusCode(error: unknown): number | null {
  if (!(error instanceof Error)) return null;
  const match = /Agent data API error:\s*(\d{3})/.exec(error.message);
  if (!match) return null;
  const code = Number(match[1]);
  return Number.isFinite(code) ? code : null;
}

/**
 * Calls a function with a single bounded retry for transient failures.
 *
 * @param params - Collaborators and retry configuration.
 * @param params.fn - Async operation to execute.
 * @param params.maxAttempts - Maximum attempts including the first call.
 * @param params.shouldRetry - Decides whether an error is transient.
 * @returns The successful result and the number of attempts used.
 */
async function callWithRetry<TResult>(params: {
  fn: () => Promise<TResult>;
  maxAttempts: number;
  shouldRetry: (error: unknown) => boolean;
}): Promise<{ result: TResult; attempts: number }> {
  const { fn, maxAttempts, shouldRetry } = params;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      return { result, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !shouldRetry(error)) {
        throw error;
      }
    }
  }

  // This is unreachable due to the loop bounds, but keeps TypeScript satisfied.
  throw lastError;
}

const BodySchemaInner = z.object({
  maxMessagesPerRun: z.number().default(20),
  watermark: z.string().datetime().optional(),
});
const BodySchema = BodySchemaInner as unknown as z.ZodType<
  { maxMessagesPerRun: number; watermark?: string },
  z.ZodTypeDef,
  { maxMessagesPerRun: number; watermark?: string }
>;

type Input = { maxMessagesPerRun: number; watermark?: string };

const ConfigSchema = z.object({
  outlookClientId: z.string().min(1),
  outlookClientSecret: z.string().min(1),
  outlookTenantId: z.string().min(1),
  outlookUserId: z.string().min(1),
  resendApiKey: z.string().min(1),
  resendSender: z.string().min(1),
});

export type Config = z.infer<typeof ConfigSchema>;

const app = createAgentApp<
  Input,
  typeof BodySchema,
  Config,
  typeof ConfigSchema
>(
  {
    agentId: "user-registration",
    agentVersion: "1.0.0",
    inputSchema: BodySchema,
    configSchema: ConfigSchema,
    run: async ({ input, token, config }) => {
      logger.info(
        `Running user-registration agent. Max messages: ${input.maxMessagesPerRun}`,
      );

      const inboxClient = createOutlookInboxClient({
        clientId: config.outlookClientId,
        clientSecret: config.outlookClientSecret,
        tenantId: config.outlookTenantId,
        userId: config.outlookUserId,
      });

      const resend = new Resend(config.resendApiKey);

      const dataApiClient = createAgentDataApiClient({
        baseUrl: env.AGENT_DATA_API_URL!,
        version: "v1",
        token,
      });

      // Step 0: List messages
      const messages = await inboxClient.listMessages(
        {
          subjectContains: "[MediaPulse] Newsletter Subscription",
          isUnread: true,
          ...(input.watermark
            ? { receivedAfter: new Date(input.watermark) }
            : {}),
        },
        { top: input.maxMessagesPerRun },
      );

      logger.info(`Found ${messages.length} messages to process.`);

      const results = [];

      for (const msg of messages) {
        // Step 1: Parse
        const senderEmail = extractSenderEmail(msg);
        const tickerSymbol = extractTickerSymbol(
          msg.subject,
          msg.body?.content,
        );

        if (!senderEmail || !tickerSymbol) {
          logger.warn(
            {
              parseFailureReason: "Missing sender or ticker",
              messageId: msg.id,
            },
            "Archiving unparseable message.",
          );
          await inboxClient.archiveMessage(msg.id!);
          results.push({ id: msg.id, status: "archived_unparseable" });
          continue;
        }

        const name = deriveNameFromEmailLocalPart(senderEmail);

        // Step 2: Register via API
        try {
          const { result: registerResponse, attempts: registerAttempts } =
            await callWithRetry({
              fn: () =>
                dataApiClient.userRegistrationRegister.create({
                  email: senderEmail,
                  tickerSymbol,
                  name,
                  audit: {
                    graphMessageId: msg.id,
                    receivedAt: msg.receivedDateTime,
                  },
                }),
              maxAttempts: 2,
              shouldRetry: (error) => {
                const statusCode = getAgentDataApiStatusCode(error);
                if (statusCode == null) return true; // network / unknown SDK error
                return statusCode === 429 || statusCode >= 500;
              },
            });

          if (registerAttempts > 1) {
            logger.warn(
              {
                messageId: msg.id,
                senderEmail,
                tickerSymbol,
                registerAttempts,
              },
              "Register call succeeded after retry.",
            );
          }

          if (!registerResponse.tickerKnown) {
            logger.info(
              { tickerSymbol, senderEmail },
              "Ticker unknown, sending invalid-ticker email.",
            );

            await resend.emails.send({
              from: config.resendSender,
              to: senderEmail,
              subject: "Invalid Ticker Selection - MediaPulse",
              text: `Hello,\n\nThe ticker '${tickerSymbol}' you selected is invalid or not recognized by our system.\nPlease visit the registration site and select a valid ticker.\n\nThank you,\nMediaPulse Team`,
            });

            await inboxClient.archiveMessage(msg.id!);
            results.push({
              id: msg.id,
              status: "invalid_ticker_archived",
              registerAttempts,
            });
            continue;
          }

          if (registerResponse.isNewSubscription) {
            logger.info(
              { senderEmail, tickerSymbol },
              "Sending confirmation email.",
            );

            await resend.emails.send({
              from: config.resendSender,
              to: senderEmail,
              subject: "Subscription Confirmed - MediaPulse",
              text: `Hello,\n\nYour subscription to the '${tickerSymbol}' newsletter has been confirmed.\n\nThank you,\nMediaPulse Team`,
            });

            try {
              await dataApiClient.userRegistrationConfirm.create({
                userTickerId: registerResponse.userTickerId!,
                audit: {
                  graphMessageId: msg.id,
                },
              });
            } catch (confirmError) {
              logger.error(
                { confirmError, messageId: msg.id },
                "Failed to call confirm API; archiving anyway to clear inbox.",
              );
            }

            await inboxClient.archiveMessage(msg.id!);
            results.push({
              id: msg.id,
              status: "confirmed_archived",
              registerAttempts,
            });
          } else {
            logger.info(
              { senderEmail, tickerSymbol },
              "Subscription already active, archiving with no email.",
            );
            await inboxClient.archiveMessage(msg.id!);
            results.push({
              id: msg.id,
              status: "idempotent_archived",
              registerAttempts,
            });
          }
        } catch (error) {
          logger.error(
            { error, messageId: msg.id },
            "Failed processing message during agent run. Leaving unarchived for retry.",
          );
          results.push({ id: msg.id, status: "failed_retry" });
        }
      }

      return {
        success: true,
        processed: results.length,
        results,
      };
    },
  },
  {
    authApiUrl: env.AGENT_AUTH_API_URL,
    autoRegister:
      env.AGENT_REGISTRY_URL &&
      env.DOMAIN_INTEGRATION_API_KEY &&
      env.AGENT_PUBLIC_URL &&
      env.AGENT_AUTH_API_URL
        ? {
            registryUrl: env.AGENT_REGISTRY_URL,
            domainIntegrationId: env.DOMAIN_INTEGRATION_ID ?? "mediapulse",
            domainIntegrationApiKey: env.DOMAIN_INTEGRATION_API_KEY,
            agentUrl: env.AGENT_PUBLIC_URL,
          }
        : undefined,
  },
);

export { app };

export default {
  port: env.PORT ?? 4004,
  fetch: app.fetch,
};
