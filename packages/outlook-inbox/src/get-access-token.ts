import got from "got";

const GRAPH_SCOPE = "https://graph.microsoft.com/.default";

/** Config required for client credentials token request. */
export type ClientCredentialsConfig = {
  clientId: string;
  clientSecret: string;
  tenantId: string;
};

/** Response shape from Microsoft token endpoint. */
type TokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

/** Options for getAccessTokenFromClientCredentials (DI). */
export type GetAccessTokenOptions = {
  /** HTTP client for POST to token endpoint; defaults to got.post. */
  requestFn?: (
    url: string,
    options: { body: string; headers: Record<string, string> },
  ) => Promise<{ body: string; statusCode: number }>;
};

/**
 * Fetches an access token using OAuth2 client credentials for Microsoft Graph.
 * Calls https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token.
 *
 * @param config - clientId, clientSecret, tenantId.
 * @param options - Optional requestFn for DI (defaults to got.post).
 * @returns The access_token string.
 * @throws Error when the response is not 2xx or when the body does not contain access_token.
 */
export async function getAccessTokenFromClientCredentials(
  config: ClientCredentialsConfig,
  options: GetAccessTokenOptions = {},
): Promise<string> {
  const { clientId, clientSecret, tenantId } = config;
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: GRAPH_SCOPE,
  }).toString();

  const requestFn = options.requestFn ?? defaultRequest;
  const res = await requestFn(url, {
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (res.statusCode < 200 || res.statusCode >= 300) {
    let message = `Token request failed: ${res.statusCode}`;
    try {
      const err = JSON.parse(res.body) as TokenResponse;
      if (err.error_description) message += ` - ${err.error_description}`;
      else if (err.error) message += ` - ${err.error}`;
    } catch {
      // use status only
    }
    throw new Error(message);
  }

  const data = JSON.parse(res.body) as TokenResponse;
  if (typeof data.access_token !== "string") {
    throw new Error("Token response missing access_token");
  }
  return data.access_token;
}

async function defaultRequest(
  url: string,
  options: { body: string; headers: Record<string, string> },
): Promise<{ body: string; statusCode: number }> {
  const res = await got.post(url, {
    body: options.body,
    headers: options.headers,
    throwHttpErrors: false,
  });
  const bodyStr =
    typeof res.body === "string" ? res.body : JSON.stringify(res.body);
  return { body: bodyStr, statusCode: res.statusCode ?? 0 };
}
