import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import { env } from "@mediapulse/env/app-user-registration";
import { tickersArraySchema, type Ticker } from "@/lib/tickers";

/**
 * Fetches ticker rows from agent-data-api and maps them to the registration ticker shape
 * (`KodeEmiten` / `NamaEmiten` match IDX-style labels used by the mailto body).
 * Same bearer bypass as the user-registration unsubscribe routes (no `Authorization` header).
 *
 * @param createClient - Injected SDK factory for tests.
 * @returns Parsed ticker list ready for the registration form.
 */
export const loadRegistrationTickers = async (
  createClient: typeof createAgentDataApiClient = createAgentDataApiClient,
): Promise<Ticker[]> => {
  const client = createClient({
    baseUrl: env.AGENT_DATA_API_URL,
    version: "v1",
  });

  const { tickers } = await client.userRegistrationTickers.get({});

  return tickersArraySchema.parse(
    tickers.map((row) => ({
      KodeEmiten: row.symbol,
      NamaEmiten: row.name,
    })),
  );
};
