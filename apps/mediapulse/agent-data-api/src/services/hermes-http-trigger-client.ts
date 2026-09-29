export type InvokeHermesHttpTriggerArgs = {
  triggerId: string;
  token: string;
  params: Record<string, string>;
  requestId: string;
};

export type InvokeHermesHttpTriggerResult = {
  executionId: string | null;
};

export type InvokeHermesHttpTrigger = (
  args: InvokeHermesHttpTriggerArgs,
) => Promise<InvokeHermesHttpTriggerResult>;

export type HermesHttpTriggerClientOptions = {
  baseUrl: string;
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

const readExecutionId = async (response: Response): Promise<string | null> => {
  try {
    const body = (await response.json()) as { executionId?: unknown };

    return typeof body.executionId === "string" ? body.executionId : null;
  } catch {
    return null;
  }
};

export const createHermesHttpTriggerClient = ({
  baseUrl,
  timeoutMs,
  fetchImpl = fetch,
}: HermesHttpTriggerClientOptions): InvokeHermesHttpTrigger => {
  const origin = baseUrl.replace(/\/+$/, "");

  return async ({ triggerId, token, params, requestId }) => {
    const url = `${origin}/api/http-triggers/${encodeURIComponent(triggerId)}/invoke`;
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify({ params }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status !== 202) {
      const errorBody = await readErrorBody(response);
      throw new Error(
        `Hermes trigger ${triggerId} answered ${response.status}: ${errorBody}`,
      );
    }

    return { executionId: await readExecutionId(response) };
  };
};
