import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import { createAgentApp } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-delivery";
import { z } from "zod";

import { sendEmailToUsers } from "./send-email-to-users.js";

const BodySchema = z.object({
  tickerId: z.string().uuid(),
});

type Input = z.infer<typeof BodySchema>;

const app = createAgentApp<Input, typeof BodySchema>(
  {
    agentId: "delivery",
    agentVersion: "1.0.0",
    inputSchema: BodySchema,
    run: async ({ input, token }) => {
      const dataApiClient = createAgentDataApiClient({
        baseUrl: env.AGENT_DATA_API_URL,
        version: "v1",
        token,
      });
      const deliveryData = await dataApiClient.delivery.get({
        tickerId: input.tickerId,
      });

      if (!deliveryData?.newsletter) {
        return {
          success: true,
          message: "Skipped: no newsletter to deliver",
        };
      }

      const { newsletter, subscribers } = deliveryData;

      if (subscribers.length > 0) {
        await sendEmailToUsers(newsletter, subscribers);
      }

      await dataApiClient.delivery.create({
        userTickerId: input.tickerId,
      });

      return { success: true };
    },
  },
  {
    authApiUrl: env.AGENT_AUTH_API_URL,
    autoRegister:
      env.AGENT_REGISTRY_URL && env.AGENT_API_KEY && env.AGENT_PUBLIC_URL
        ? {
            registryUrl: env.AGENT_REGISTRY_URL,
            schedulerApiKey: env.AGENT_API_KEY,
            agentUrl: env.AGENT_PUBLIC_URL,
          }
        : undefined,
  },
);

export default {
  port: env.PORT ?? 4003,
  fetch: app.fetch,
};
