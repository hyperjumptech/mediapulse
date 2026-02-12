import { env } from "@workspace/env/agents-delivery";

export async function sendToAgentDataAPI(token: string | undefined) {
  const url = new URL(env.AGENT_DATA_API_URL);
  url.pathname = "/delivery";

  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: token }),
    },
    body: JSON.stringify({
      userTickerId: "user_ticker_id_test",
    }),
  });
}
