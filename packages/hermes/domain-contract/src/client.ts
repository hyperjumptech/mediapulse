import {
  domainHealthResponseSchema,
  expandStepInputsResponseSchema,
  previewExpansionResponseSchema,
  type ExpandStepInputsRequest,
  type ExpandStepInputsResponse,
  type DomainHealthResponse,
  type PreviewExpansionRequest,
  type PreviewExpansionResponse,
} from "./contracts";

type FetchLike = typeof fetch;

type DomainClientOptions = {
  baseUrl: string;
  authToken?: string;
  fetchImpl?: FetchLike;
};

/**
 * Creates a typed HTTP client for a domain integration.
 *
 * @param options - Domain integration endpoint and auth settings.
 * @returns Methods for health, preview, and expansion calls.
 */
export const createDomainIntegrationClient = (options: DomainClientOptions) => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, "");

  const createHeaders = (): Record<string, string> => {
    if (!options.authToken) return { "Content-Type": "application/json" };
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.authToken}`,
    };
  };

  const parseJson = async <T>(
    response: Response,
    parser: (value: unknown) => T,
  ): Promise<T> => {
    const payload = (await response.json()) as unknown;
    return parser(payload);
  };

  return {
    /**
     * Calls the integration health endpoint.
     *
     * @returns Health response.
     */
    health: async (): Promise<DomainHealthResponse> => {
      const response = await fetchImpl(`${baseUrl}/v1/health`, {
        method: "GET",
        headers: createHeaders(),
      });
      if (!response.ok) {
        throw new Error(`Domain health failed with status ${response.status}`);
      }
      return parseJson(response, (value) =>
        domainHealthResponseSchema.parse(value),
      );
    },

    /**
     * Calls preview-expansion endpoint for a single expansion string.
     *
     * @param body - Preview request payload.
     * @returns Preview response payload.
     */
    previewExpansion: async (
      body: PreviewExpansionRequest,
    ): Promise<PreviewExpansionResponse> => {
      const response = await fetchImpl(`${baseUrl}/v1/preview-expansion`, {
        method: "POST",
        headers: createHeaders(),
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(
          `Preview request failed with status ${response.status}`,
        );
      }
      return parseJson(response, (value) =>
        previewExpansionResponseSchema.parse(value),
      );
    },

    /**
     * Calls expand-step-inputs endpoint for scheduler fan-out.
     *
     * @param body - Expand request payload.
     * @returns Expanded input list.
     */
    expandStepInputs: async (
      body: ExpandStepInputsRequest,
    ): Promise<ExpandStepInputsResponse> => {
      const response = await fetchImpl(`${baseUrl}/v1/expand-step-inputs`, {
        method: "POST",
        headers: createHeaders(),
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(`Expand request failed with status ${response.status}`);
      }
      return parseJson(response, (value) =>
        expandStepInputsResponseSchema.parse(value),
      );
    },
  };
};
