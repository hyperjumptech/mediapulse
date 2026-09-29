import { parseRunParams, type RunParams } from "@hermes/scheduler/run-params";

export type ReadHttpTriggerRunParamsResult =
  | { success: true; params: RunParams | null }
  | { success: false; error: string };

const isJsonContentType = (contentType: string | null): boolean => {
  const primaryType = contentType?.split(";")[0]?.trim().toLowerCase() ?? "";

  return primaryType === "application/json" || primaryType.endsWith("+json");
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const readHttpTriggerRunParams = async (
  request: Request,
): Promise<ReadHttpTriggerRunParamsResult> => {
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return { success: true, params: null };
  }

  let bodyText: string;
  try {
    bodyText = await request.clone().text();
  } catch {
    return { success: true, params: null };
  }
  if (bodyText.trim() === "") {
    return { success: true, params: null };
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return { success: true, params: null };
  }
  if (!isPlainObject(body) || !Object.hasOwn(body, "params")) {
    return { success: true, params: null };
  }

  const result = parseRunParams(body.params);
  if (!result.success) {
    return { success: false, error: result.error };
  }
  const hasParams = Object.keys(result.params).length > 0;

  return { success: true, params: hasParams ? result.params : null };
};
