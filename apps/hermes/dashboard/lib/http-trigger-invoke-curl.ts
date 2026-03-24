/** HTTP methods allowed for HTTP trigger invoke cURL examples. */
export type HttpTriggerInvokeMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH";

/**
 * Builds a cURL command to invoke an HTTP trigger (Bearer token placeholder).
 */
export const buildHttpTriggerInvokeCurlCommand = ({
  method,
  triggerId,
  origin,
}: {
  method: HttpTriggerInvokeMethod;
  triggerId: string;
  origin: string;
}): string =>
  `curl -X ${method} "${origin}/api/http-triggers/${triggerId}/invoke" -H "Authorization: Bearer <YOUR_TRIGGER_TOKEN>"`;
