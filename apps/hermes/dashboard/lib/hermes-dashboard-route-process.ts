import {
  createRequestValidator,
  errorResponse,
  type HandlerFunc,
  type HandlerResponse,
} from "route-action-gen/lib";
import type { z } from "zod";

import { DashboardReadOnlyApiKeyError } from "@/lib/dashboard-read-only-api-key-error";

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

/**
 * Converts a route-action-gen error payload into a Next.js `Response`.
 *
 * @param response - Error payload from `errorResponse`.
 * @returns JSON HTTP response.
 */
const toErrorHttpResponse = (response: ReturnType<typeof errorResponse>) => {
  const code =
    typeof response.object === "object" &&
    response.object !== null &&
    "code" in response.object
      ? (response.object as { code: string }).code
      : undefined;

  if (code === "read_only_key") {
    return new Response(
      JSON.stringify({ code: "read_only_key", message: response.message }),
      {
        status: response.statusCode,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return new Response(
    JSON.stringify({
      message: response.message,
      statusCode: response.statusCode,
    }),
    {
      status: response.statusCode,
      headers: { "Content-Type": "application/json" },
    },
  );
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
    const [
      validatedBody,
      validatedHeaders,
      validatedParams,
      validatedSearchParams,
    ] = await Promise.all([
      validateBodyFromRequest(requestValidator.body, request),
      validateHeaders(requestValidator.headers, request.headers),
      validateParams(requestValidator.params, params),
      validateSearchParamsFromRequest(requestValidator.searchParams, request),
    ]);

    type HandlerParameters = Parameters<HandlerFunc<RV, TV, Input>>[0];

    return handler({
      body: validatedBody,
      headers: validatedHeaders,
      params: validatedParams,
      searchParams: validatedSearchParams,
      user,
    } as HandlerParameters).then(toHttpResponse);
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
