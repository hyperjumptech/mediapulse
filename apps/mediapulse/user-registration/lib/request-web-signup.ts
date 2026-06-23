import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import { env } from "@mediapulse/env/app-user-registration";
import type { RegistrationLanguage } from "@/lib/tickers";

type WebSignupResult = {
  tickerKnown: boolean;
  userTickerId?: string;
  isNewSubscription: boolean;
};

type CreateClient = typeof createAgentDataApiClient;

/**
 * Creates an unconfirmed subscription via agent-data-api web signup.
 *
 * @param input - Signup fields from the public registration form.
 * @param createClient - Injected SDK factory for tests.
 * @returns Parsed signup outcome from agent-data-api.
 */
export const requestWebSignup = async (
  input: {
    email: string;
    name: string;
    tickerSymbol: string;
    language: RegistrationLanguage;
  },
  createClient: CreateClient = createAgentDataApiClient,
): Promise<WebSignupResult> => {
  const client = createClient({
    baseUrl: env.AGENT_DATA_API_URL,
    version: "v1",
  });

  const response = await client.userRegistrationWebSignup.create({
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    tickerSymbol: input.tickerSymbol,
    language: input.language,
  });

  return {
    tickerKnown: response.tickerKnown,
    userTickerId: response.userTickerId,
    isNewSubscription: response.isNewSubscription,
  };
};
