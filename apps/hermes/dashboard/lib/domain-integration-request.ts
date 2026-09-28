import {
  getBearerJwtForDomainIntegrationId,
  invalidateDomainIntegrationToken,
} from "@/lib/domain-integration-auth-token";

export const DOMAIN_READ_TIMEOUT_MS = 10_000;

export const DOMAIN_WRITE_TIMEOUT_MS = 30_000;

const READ_METHODS = new Set(["GET", "HEAD"]);

export class DomainIntegrationTimeoutError extends Error {
  constructor(integrationLabel: string, timeoutMs: number, cause: unknown) {
    const timeoutSeconds = timeoutMs / 1000;
    super(
      `Domain integration "${integrationLabel}" did not respond within ${timeoutSeconds}s`,
      { cause },
    );
    this.name = "DomainIntegrationTimeoutError";
  }
}

export type DomainIntegrationRequest = {
  url: string;
  domainIntegrationId: string;
  integrationLabel: string;
  init?: RequestInit;
  fetchImpl?: typeof fetch;
};

const resolveTimeoutMs = (init: RequestInit | undefined): number => {
  const method = (init?.method ?? "GET").toUpperCase();

  return READ_METHODS.has(method)
    ? DOMAIN_READ_TIMEOUT_MS
    : DOMAIN_WRITE_TIMEOUT_MS;
};

const isTimeoutError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === "TimeoutError" || error.name === "AbortError");

const mapTimeoutError = (
  error: unknown,
  request: DomainIntegrationRequest,
  timeoutMs: number,
): unknown => {
  if (!isTimeoutError(error)) {
    return error;
  }

  return new DomainIntegrationTimeoutError(
    request.integrationLabel,
    timeoutMs,
    error,
  );
};

const discardResponseBody = async (response: Response): Promise<void> => {
  await response.body?.cancel().catch(() => undefined);
};

const sendDomainIntegrationRequest = async (
  request: DomainIntegrationRequest,
  jwt: string | undefined,
  timeoutMs: number,
): Promise<Response> => {
  const headers = new Headers(request.init?.headers);
  if (jwt) {
    headers.set("Authorization", `Bearer ${jwt}`);
  }
  const fetchImpl = request.fetchImpl ?? fetch;

  try {
    return await fetchImpl(request.url, {
      ...request.init,
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw mapTimeoutError(error, request, timeoutMs);
  }
};

const fetchWithTokenRetry = async (
  request: DomainIntegrationRequest,
  timeoutMs: number,
): Promise<Response> => {
  const jwt = await getBearerJwtForDomainIntegrationId(
    request.domainIntegrationId,
  );
  const response = await sendDomainIntegrationRequest(request, jwt, timeoutMs);
  if (response.status !== 401 || !jwt) {
    return response;
  }

  await discardResponseBody(response);
  invalidateDomainIntegrationToken(request.domainIntegrationId);
  const refreshedJwt = await getBearerJwtForDomainIntegrationId(
    request.domainIntegrationId,
  );

  return sendDomainIntegrationRequest(request, refreshedJwt, timeoutMs);
};

export const requestDomainIntegration = async <Result>(
  request: DomainIntegrationRequest,
  readResponse: (response: Response) => Promise<Result>,
): Promise<Result> => {
  const timeoutMs = resolveTimeoutMs(request.init);
  const response = await fetchWithTokenRetry(request, timeoutMs);

  try {
    return await readResponse(response);
  } catch (error) {
    throw mapTimeoutError(error, request, timeoutMs);
  }
};
