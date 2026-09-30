import {
  createRequestValidator,
  errorResponse,
  type HandlerFunc,
  type HandlerResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { DashboardReadOnlyApiKeyError } from "@/lib/dashboard-read-only-api-key-error";

export const INTERNAL_ERROR_CODE = "internal_error";

export const internalErrorResponse = (message: string) =>
  errorResponse(message, { code: INTERNAL_ERROR_CODE }, 500);

type ValidationIssue = {
  path: string;
  message: string;
};

type Validator = ReturnType<typeof createRequestValidator>;

type RequestValidator = {
  body?: { parseAsync: (value: unknown) => Promise<unknown> };
  params?: { parseAsync: (value: unknown) => Promise<unknown> };
  headers?: { parseAsync: (value: unknown) => Promise<unknown> };
  searchParams?: { parseAsync: (value: unknown) => Promise<unknown> };
  user?: (request?: Request) => Promise<unknown>;
};

/**
 * Authenticates the dashboard route user, mapping read-only MCP keys to HTTP 403.
 *
 * @param auth - Optional user validator from `createRequestValidator`.
 * @param request - Incoming HTTP request when present.
 * @returns Authenticated user or an error response for the route layer.
 */
const authenticateDashboardRouteUser = async (
  auth: RequestValidator["user"],
  request?: Request,
): Promise<{ user: unknown } | { error: ReturnType<typeof errorResponse> }> => {
  if (!auth) {
    return { user: null };
  }
  try {
    const user = request ? await auth(request) : await auth();
    return { user };
  } catch (error) {
    if (error instanceof DashboardReadOnlyApiKeyError) {
      return {
        error: errorResponse(error.message, { code: error.code }, 403),
      };
    }
    return { error: errorResponse("Unauthorized", undefined, 401) };
  }
};

/**
 * Parses JSON or form bodies from an HTTP request.
 *
 * @param request - Incoming HTTP request.
 * @returns Parsed body payload or null.
 */
const parseRequestBody = async (request: Request): Promise<unknown> => {
  const requestType = request.headers.get("content-type");
  if (requestType?.includes("application/json")) {
    return request.json();
  }
  if (
    requestType?.includes("application/x-www-form-urlencoded") ||
    requestType?.includes("multipart/form-data")
  ) {
    const formData = await request.formData();
    return Object.fromEntries(formData.entries());
  }
  if (requestType?.includes("text/plain")) {
    return request.text();
  }
  return null;
};

/**
 * Validates the request body when the method supports one.
 *
 * @param bodyValidator - Zod body schema.
 * @param request - Incoming HTTP request.
 * @returns Parsed body or null.
 */
const validateBodyFromRequest = async (
  bodyValidator: RequestValidator["body"],
  request: Request,
): Promise<unknown> => {
  const method = request.method.toLowerCase();
  const isBodyMethod =
    method === "post" || method === "put" || method === "patch";
  if (!bodyValidator || !isBodyMethod) {
    return null;
  }
  const requestBody = await parseRequestBody(request);
  return bodyValidator.parseAsync(requestBody);
};

/**
 * Validates request headers against a Zod schema.
 *
 * @param headersValidator - Zod headers schema.
 * @param headersSource - Header map from the request.
 * @returns Parsed headers or null.
 */
const validateHeaders = async (
  headersValidator: RequestValidator["headers"],
  headersSource: Headers,
): Promise<unknown> => {
  if (!headersValidator) {
    return null;
  }
  const headersObj: Record<string, string> = {};
  for (const [key, value] of headersSource.entries()) {
    headersObj[key.toLowerCase()] = value;
  }
  return headersValidator.parseAsync(headersObj);
};

/**
 * Validates route params against a Zod schema.
 *
 * @param paramsValidator - Zod params schema.
 * @param params - Route params from Next.js.
 * @returns Parsed params or null.
 */
const validateParams = async (
  paramsValidator: RequestValidator["params"],
  params: unknown,
): Promise<unknown> => {
  if (!paramsValidator || !params) {
    return null;
  }
  return paramsValidator.parseAsync(params);
};

/**
 * Validates URL search params against a Zod schema.
 *
 * @param searchParamsValidator - Zod search params schema.
 * @param request - Incoming HTTP request.
 * @returns Parsed search params or null.
 */
const validateSearchParamsFromRequest = async (
  searchParamsValidator: RequestValidator["searchParams"],
  request: Request,
): Promise<unknown> => {
  if (!searchParamsValidator) {
    return null;
  }
  const url = new URL(request.url);
  const searchParamsObj: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    searchParamsObj[key] = value;
  }
  return searchParamsValidator.parseAsync(searchParamsObj);
};

const errorObjectField = (
  response: ReturnType<typeof errorResponse>,
  field: string,
): unknown =>
  typeof response.object === "object" &&
  response.object !== null &&
  field in response.object
    ? (response.object as Record<string, unknown>)[field]
    : undefined;

const resolveErrorStatusCode = (
  response: ReturnType<typeof errorResponse>,
): number => {
  if (response.statusCode !== 500) {
    return response.statusCode;
  }
  const isInternalError =
    errorObjectField(response, "code") === INTERNAL_ERROR_CODE;

  return isInternalError ? 500 : 400;
};

const toErrorHttpResponse = (response: ReturnType<typeof errorResponse>) => {
  const code = errorObjectField(response, "code");
  const statusCode = resolveErrorStatusCode(response);
  const headers = { "Content-Type": "application/json" };

  if (code === "read_only_key") {
    return new Response(
      JSON.stringify({ code: "read_only_key", message: response.message }),
      { status: statusCode, headers },
    );
  }

  const issues = errorObjectField(response, "issues");

  return new Response(
    JSON.stringify({
      message: response.message,
      statusCode,
      ...(Array.isArray(issues) ? { issues } : {}),
    }),
    { status: statusCode, headers },
  );
};

const validationIssuesFromError = (error: unknown): ValidationIssue[] =>
  error instanceof z.ZodError
    ? error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      }))
    : [];

const describeValidationIssue = (issue: ValidationIssue): string =>
  issue.path === "" ? issue.message : `${issue.path}: ${issue.message}`;

const validationErrorResponse = (error: unknown) => {
  const issues = validationIssuesFromError(error);
  const detail =
    issues.length > 0
      ? issues.map(describeValidationIssue).join("; ")
      : error instanceof Error
        ? error.message
        : "Invalid request";

  return errorResponse(`Invalid request: ${detail}`, { issues }, 400);
};

const prismaErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }
  const code = (error as { code: unknown }).code;

  return typeof code === "string" ? code : undefined;
};

const thrownHandlerErrorResponse = (error: unknown) => {
  const code = prismaErrorCode(error);
  if (code === "P2025") {
    return errorResponse("Record not found", undefined, 404);
  }
  if (code === "P2002") {
    return errorResponse(
      "A record with these values already exists",
      undefined,
      409,
    );
  }
  console.error("Hermes dashboard route failed", error);

  return internalErrorResponse("Internal server error");
};

/**
 * Converts a route-action-gen handler result into a Next.js `Response`.
 *
 * @typeParam TResponse - Zod schema for successful response body.
 * @typeParam Input - Optional traced input carried on success responses.
 * @param response - Success or error payload from a route handler.
 * @returns JSON HTTP response.
 */
const toHttpResponse = <TResponse extends z.ZodType, Input>(
  response: HandlerResponse<TResponse, Input>,
) => {
  if (response.status === false) {
    return toErrorHttpResponse(response as ReturnType<typeof errorResponse>);
  }

  return new Response(JSON.stringify(response.data), {
    status: response.statusCode,
  });
};

/**
 * Processes a dashboard POST route with read-only API key → 403 support.
 *
 * @typeParam RV - Request validator from `createRequestValidator`.
 * @typeParam TV - Zod schema for successful response body.
 * @typeParam Input - Optional traced handler input metadata.
 * @param requestValidator - Route request validator.
 * @param responseValidator - Route response validator (unused; kept for parity with route-action-gen).
 * @param handler - Business handler.
 * @returns Next.js App Router POST processor.
 */
export const processHermesDashboardRequest = <
  RV extends Validator,
  TV extends z.ZodType,
  Input,
>(
  requestValidator: RV,
  responseValidator: TV,
  handler: HandlerFunc<RV, TV, Input>,
) => {
  void responseValidator;

  return async (request: Request, params?: unknown) => {
    const authResult = await authenticateDashboardRouteUser(
      requestValidator.user,
      request,
    );
    if ("error" in authResult) {
      return toErrorHttpResponse(authResult.error);
    }

    const { user } = authResult;
    let validatedInput: unknown[];
    try {
      validatedInput = await Promise.all([
        validateBodyFromRequest(requestValidator.body, request),
        validateHeaders(requestValidator.headers, request.headers),
        validateParams(requestValidator.params, params),
        validateSearchParamsFromRequest(requestValidator.searchParams, request),
      ]);
    } catch (error) {
      return toErrorHttpResponse(validationErrorResponse(error));
    }
    const [
      validatedBody,
      validatedHeaders,
      validatedParams,
      validatedSearchParams,
    ] = validatedInput;

    type HandlerParameters = Parameters<HandlerFunc<RV, TV, Input>>[0];

    try {
      const response = await handler({
        body: validatedBody,
        headers: validatedHeaders,
        params: validatedParams,
        searchParams: validatedSearchParams,
        user,
      } as HandlerParameters);

      return toHttpResponse(response);
    } catch (error) {
      return toErrorHttpResponse(thrownHandlerErrorResponse(error));
    }
  };
};

/**
 * Creates a dashboard POST route with read-only API key → 403 support.
 *
 * @typeParam RV - Request validator from `createRequestValidator`.
 * @typeParam TV - Zod schema for successful response body.
 * @typeParam Input - Optional traced handler input metadata.
 * @param requestValidator - Route request validator.
 * @param responseValidator - Route response validator.
 * @param handler - Business handler.
 * @returns Next.js App Router POST export.
 */
export const createHermesDashboardRoute = <
  RV extends Validator,
  TV extends z.ZodType,
  Input,
>(
  requestValidator: RV,
  responseValidator: TV,
  handler: HandlerFunc<RV, TV, Input>,
) => {
  return async (
    request: Request,
    context?: { params?: Promise<Record<string, string | string[]>> },
  ) => {
    const processFunc = processHermesDashboardRequest(
      requestValidator,
      responseValidator,
      handler,
    );
    const params = await context?.params;
    const response = await processFunc(request, params);
    if (response instanceof Response) {
      return response;
    }
    return toHttpResponse(response);
  };
};
