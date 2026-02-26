import got from "got";

import { env } from "@workspace/env/agents-delivery";

export async function sendToAgentDataAPI(
  token: string | undefined,
  tickerId: string,
) {
  const url = new URL(env.AGENT_DATA_API_URL);
  url.pathname = "/api/delivery";

  await got.post(url.toString(), {
    json: { userTickerId: tickerId },
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: token }),
    },
  });
}
