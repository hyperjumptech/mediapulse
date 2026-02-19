import got from "got";

import { env } from "@workspace/env/agents-delivery";

export async function sendToAgentDataAPI(token: string | undefined) {
  const url = new URL(env.AGENT_DATA_API_URL);
  url.pathname = "/delivery";

  await got.post(url.toString(), {
    json: { userTickerId: "user_ticker_id_test" },
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: token }),
    },
  });
}
