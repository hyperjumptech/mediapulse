import {
  createAgentApp,
  dataApiGet,
  dataApiPost,
} from "@workspace/agent-runtime";
import { env } from "@workspace/env/agents-delivery";
import { z } from "zod";

import { sendEmailToUsers } from "./send-email-to-users.js";

const BodySchema = z.object({
  tickerId: z.string().uuid(),
});

type Input = z.infer<typeof BodySchema>;

type DeliveryData = {
  newsletter: { subject: string; content: string };
  subscribers: { email: string }[];
};

const app = createAgentApp<Input, typeof BodySchema>(
  {
    agentId: "delivery",
    agentVersion: "1.0.0",
    inputSchema: BodySchema,
    run: async ({ input, token }) => {
      console.log("delivery", input.tickerId);
      const deliveryData = await dataApiGet<DeliveryData>(
        token,
        env.AGENT_DATA_API_URL,
        "/api/delivery",
        { tickerId: input.tickerId },
      );

      if (!deliveryData?.newsletter) {
        return {
          success: false,
          statusCode: 200,
          skipped: true,
        };
      }

      const { newsletter, subscribers } = deliveryData;

      if (subscribers.length > 0) {
        await sendEmailToUsers(newsletter, subscribers);
      }

      await dataApiPost(token, env.AGENT_DATA_API_URL, "/api/delivery", {
        userTickerId: input.tickerId,
      });

      return { success: true };
    },
  },
  {
    authApiUrl: env.AGENT_AUTH_API_URL,
  },
);

export default {
  port: env.PORT ?? 4003,
  fetch: app.fetch,
};
