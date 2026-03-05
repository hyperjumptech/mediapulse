import got from "got";

export interface AgentGetOptions {
  query?: Record<string, string>;
  apiKey?: string;
}

export interface AgentPostOptions<TRequest> {
  body: TRequest;
  apiKey?: string;
}

/**
 * Generic HTTP client for talking to the Agent Data API.
 * Callers supply query params and payloads; this client handles URL and JSON transport.
 */
export class AgentDataApiClient {
  private readonly url: string;

  constructor(opts: { url: string }) {
    this.url = opts.url;
  }

  /**
   * Issues a GET request and parses the JSON response as T.
   */
  async get<T>(options: AgentGetOptions = {}): Promise<T> {
    const url = this.buildUrl(options.query);

    const res = await got.get(url, {
      headers: this.buildHeaders(options.apiKey),
    });

    return JSON.parse(res.body) as T;
  }

  /**
   * Issues a POST request with a JSON body and optionally parses a JSON response.
   */
  async post<TRequest, TResponse = void>(
    options: AgentPostOptions<TRequest>,
  ): Promise<TResponse> {
    const res = await got.post(this.url, {
      json: options.body,
      headers: this.buildHeaders(options.apiKey),
    });

    if (
      res.body &&
      (res.headers["content-type"] ?? "").includes("application/json")
    ) {
      return JSON.parse(res.body) as TResponse;
    }

    return undefined as TResponse;
  }

  private buildUrl(query?: Record<string, string>): string {
    if (!query) return this.url;

    const url = new URL(this.url);

    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }

    return url.toString();
  }

  private buildHeaders(apiKey?: string): Record<string, string> {
    const headers: Record<string, string> = {};

    if (apiKey) {
      headers.Authorization = apiKey;
    }

    return headers;
  }
}
