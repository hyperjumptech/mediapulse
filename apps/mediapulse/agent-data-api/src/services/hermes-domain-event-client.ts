import { domainEventResponseSchema } from "@hermes/domain-contract/contracts";

export type SendHermesDomainEventArgs = {
  event: string;
  params: Record<string, string>;
  requestId: string;
};

export type SendHermesDomainEventResult = {
  executionIds: string[];
};

export type SendHermesDomainEvent = (
  args: SendHermesDomainEventArgs,
) => Promise<SendHermesDomainEventResult>;

export type HermesDomainEventClientOptions = {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

const MAX_ERROR_BODY_LENGTH = 300;

const readErrorBody = async (response: Response): Promise<string> => {
  try {
    const text = await response.text();

    return text.slice(0, MAX_ERROR_BODY_LENGTH);
  } catch {
    return "";
  }
};

export const createHermesDomainEventClient = ({
  baseUrl,
  apiKey,
  timeoutMs,
  fetchImpl = fetch,
}: HermesDomainEventClientOptions): SendHermesDomainEvent => {
  const origin = baseUrl.replace(/\/+$/, "");

  return async ({ event, params, requestId }) => {
    const response = await fetchImpl(
      `${origin}/api/domain-integrations/events`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "x-request-id": requestId,
        },
        body: JSON.stringify({ event, params }),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (response.status !== 202) {
      const errorBody = await readErrorBody(response);
      throw new Error(
        `Hermes answered ${response.status} to event ${event}: ${errorBody}`,
      );
    }
    const body = domainEventResponseSchema.parse(await response.json());

    return {
      executionIds: body.executions.map((execution) => execution.executionId),
    };
  };
};
