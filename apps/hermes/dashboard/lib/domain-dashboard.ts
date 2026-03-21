import {
  createDomainIntegrationClient,
  tableV1ListResponseSchema,
  tableV1MetaResponseSchema,
} from "@hermes/domain-contract";
import type { PreviewExpansionResponse } from "@hermes/domain-contract";
import { env } from "@hermes/env";
import { z } from "zod";

import { getDomainIntegrationByKey } from "@/lib/domain-integrations";

/** Result state for JSON file custom actions (e.g. IDX import) returned from server actions. */
export type DomainTableJsonImportState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; added: number; updated: number };

export type DomainTableListParams = {
  page: number;
  pageSize: number;
  query?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
};

/**
 * Resolves a dashboard page from a specific domain integration manifest.
 *
 * @param integrationKey - Registered integration key (e.g. "mediapulse").
 * @param resource - Dashboard path segment (matches manifest `pathSegment`).
 * @returns Domain page descriptor and base URL.
 */
const getDashboardPage = async (
  integrationKey: string,
  resource: string,
): Promise<{
  page: {
    apiPrefix: string;
    pathSegment: string;
  };
  baseUrl: string;
}> => {
  const integration = await getDomainIntegrationByKey(integrationKey);
  if (!integration) {
    throw new Error(
      `Domain integration "${integrationKey}" is not active or not registered`,
    );
  }
  const page = integration.dashboard.pages.find(
    (entry) => entry.pathSegment === resource,
  );

  if (!page) {
    throw new Error(
      `Dashboard page "${resource}" is not registered for integration "${integrationKey}"`,
    );
  }

  return { page, baseUrl: integration.baseUrl.replace(/\/$/, "") };
};

/**
 * Calls a domain integration endpoint and parses its JSON payload.
 *
 * @param input - Request URL.
 * @param parser - Runtime parser for JSON payload.
 * @param init - Fetch options.
 * @returns Parsed response payload.
 */
const callDomain = async <T>(
  input: string,
  parser: (value: unknown) => T,
  init?: RequestInit,
): Promise<T> => {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (env.DOMAIN_INTEGRATION_AUTH_TOKEN) {
    headers.set("Authorization", `Bearer ${env.DOMAIN_INTEGRATION_AUTH_TOKEN}`);
  }

  const response = await fetch(input, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Domain dashboard request failed (${response.status})`);
  }
  const payload = (await response.json()) as unknown;
  return parser(payload);
};

/**
 * Loads table-v1 metadata for a dashboard resource.
 *
 * @param integrationKey - Registered integration key.
 * @param resource - Dashboard path segment.
 * @returns Meta configuration used to render the page.
 */
export const getDomainTableMeta = async (
  integrationKey: string,
  resource: string,
) => {
  const { page, baseUrl } = await getDashboardPage(integrationKey, resource);
  return callDomain(
    `${baseUrl}${page.apiPrefix}/meta`,
    tableV1MetaResponseSchema.parse,
  );
};

type CallDomainCustomPostResult =
  | { ok: true; data: unknown }
  | { ok: false; message: string };

/**
 * POSTs JSON to a domain URL and returns either parsed JSON or an error message from the response body.
 *
 * @param url - Full URL (base + apiPrefix + action path).
 * @param body - JSON-serializable body.
 * @param fetchImpl - Fetch implementation (default: global fetch).
 * @returns Parsed JSON on success or a user-facing error message.
 */
export const callDomainCustomPost = async (
  url: string,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<CallDomainCustomPostResult> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (env.DOMAIN_INTEGRATION_AUTH_TOKEN) {
    headers.Authorization = `Bearer ${env.DOMAIN_INTEGRATION_AUTH_TOKEN}`;
  }

  const response = await fetchImpl(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof (payload as { message: unknown }).message === "string"
        ? (payload as { message: string }).message
        : `Domain request failed (${response.status})`;
    return { ok: false, message };
  }

  return { ok: true, data: payload };
};

export type InvokeDomainTableCustomActionDependencies = {
  getMeta?: typeof getDomainTableMeta;
  getPage?: typeof getDashboardPage;
  callPost?: typeof callDomainCustomPost;
};

/**
 * Invokes a registered table-v1 custom action by posting a JSON payload string to the domain API.
 *
 * @param integrationKey - Registered integration key.
 * @param resource - Dashboard path segment.
 * @param actionId - Custom action `id` from manifest/meta.
 * @param payloadJson - Raw JSON file contents as a string (validated by the domain service).
 * @param dependencies - Optional collaborators for tests.
 * @returns Success with parsed response data or failure with message.
 */
export const invokeDomainTableCustomAction = async (
  integrationKey: string,
  resource: string,
  actionId: string,
  payloadJson: string,
  dependencies: InvokeDomainTableCustomActionDependencies = {},
): Promise<
  { success: true; data: unknown } | { success: false; message: string }
> => {
  const getMeta = dependencies.getMeta ?? getDomainTableMeta;
  const getPage = dependencies.getPage ?? getDashboardPage;
  const callPost = dependencies.callPost ?? callDomainCustomPost;

  const meta = await getMeta(integrationKey, resource);
  const action = meta.customActions.find((entry) => entry.id === actionId);
  if (!action) {
    return { success: false, message: "Unknown custom action" };
  }
  if (action.ui !== "json-file-upload" || action.method !== "POST") {
    return { success: false, message: "Unsupported custom action" };
  }

  const { page, baseUrl } = await getPage(integrationKey, resource);
  const url = `${baseUrl}${page.apiPrefix}${action.path}`;
  const result = await callPost(url, { payloadJson });

  if (!result.ok) {
    return { success: false, message: result.message };
  }

  return { success: true, data: result.data };
};

/**
 * Loads table-v1 list data for a dashboard resource.
 *
 * @param integrationKey - Registered integration key.
 * @param resource - Dashboard path segment.
 * @param params - Pagination, search, and sort params.
 * @returns Paginated list payload.
 */
export const getDomainTableList = async (
  integrationKey: string,
  resource: string,
  params: DomainTableListParams,
) => {
  const { page, baseUrl } = await getDashboardPage(integrationKey, resource);
  const search = new URLSearchParams();
  search.set("page", String(params.page));
  search.set("pageSize", String(params.pageSize));
  if (params.query) search.set("q", params.query);
  if (params.sortBy) search.set("sortBy", params.sortBy);
  if (params.sortDir) search.set("sortDir", params.sortDir);

  return callDomain(
    `${baseUrl}${page.apiPrefix}?${search.toString()}`,
    tableV1ListResponseSchema.parse,
  );
};

const domainTableItemResponseSchema = z.record(z.unknown());

/**
 * Loads a single table-v1 row by id when the domain API exposes GET `{apiPrefix}/{id}`.
 *
 * @param integrationKey - Registered integration key.
 * @param resource - Dashboard path segment.
 * @param id - Row id.
 * @returns Parsed row or null when the domain returns 404.
 */
export const getDomainTableItemById = async (
  integrationKey: string,
  resource: string,
  id: string,
): Promise<Record<string, unknown> | null> => {
  const { page, baseUrl } = await getDashboardPage(integrationKey, resource);
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  if (env.DOMAIN_INTEGRATION_AUTH_TOKEN) {
    headers.set("Authorization", `Bearer ${env.DOMAIN_INTEGRATION_AUTH_TOKEN}`);
  }

  const response = await fetch(`${baseUrl}${page.apiPrefix}/${id}`, {
    headers,
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Domain dashboard request failed (${response.status})`);
  }

  const payload = (await response.json()) as unknown;
  return domainTableItemResponseSchema.parse(payload);
};

type PreviewDomainExpansionDependencies = {
  getIntegration?: typeof getDomainIntegrationByKey;
  createClient?: typeof createDomainIntegrationClient;
};

/**
 * Calls the domain integration `preview-expansion` endpoint for a single expansion string.
 *
 * @param integrationKey - Registered integration key.
 * @param expansionString - Value to preview (e.g. db:table:field).
 * @param dependencies - Optional collaborators for tests.
 * @returns Parsed preview response from the domain contract.
 */
export const previewDomainExpansion = async (
  integrationKey: string,
  expansionString: string,
  dependencies: PreviewDomainExpansionDependencies = {},
): Promise<PreviewExpansionResponse> => {
  const getIntegration =
    dependencies.getIntegration ?? getDomainIntegrationByKey;
  const createClient =
    dependencies.createClient ?? createDomainIntegrationClient;

  const integration = await getIntegration(integrationKey);
  if (!integration) {
    throw new Error(
      `Domain integration "${integrationKey}" is not active or not registered`,
    );
  }
  if (!integration.capabilities.includes("preview-expansion")) {
    throw new Error(
      `Domain integration "${integrationKey}" does not support preview-expansion`,
    );
  }

  const client = createClient({
    baseUrl: integration.baseUrl,
    authToken: env.DOMAIN_INTEGRATION_AUTH_TOKEN,
  });

  return client.previewExpansion({ expansionString });
};

/**
 * Creates a domain table row through the registered API prefix.
 *
 * @param integrationKey - Registered integration key.
 * @param resource - Dashboard path segment.
 * @param body - JSON payload from create form.
 * @returns Parsed response payload from the domain API.
 */
export const createDomainTableItem = async (
  integrationKey: string,
  resource: string,
  body: Record<string, unknown>,
) => {
  const { page, baseUrl } = await getDashboardPage(integrationKey, resource);
  return callDomain(`${baseUrl}${page.apiPrefix}`, (value) => value, {
    method: "POST",
    body: JSON.stringify(body),
  });
};

/**
 * Updates a domain table row through the registered API prefix.
 *
 * @param integrationKey - Registered integration key.
 * @param resource - Dashboard path segment.
 * @param id - Row identifier.
 * @param body - JSON payload from update form.
 * @returns Parsed response payload from the domain API.
 */
export const updateDomainTableItem = async (
  integrationKey: string,
  resource: string,
  id: string,
  body: Record<string, unknown>,
) => {
  const { page, baseUrl } = await getDashboardPage(integrationKey, resource);
  return callDomain(`${baseUrl}${page.apiPrefix}/${id}`, (value) => value, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
};

/**
 * Deletes a domain table row through the registered API prefix.
 *
 * @param integrationKey - Registered integration key.
 * @param resource - Dashboard path segment.
 * @param id - Row identifier.
 * @returns Parsed response payload from the domain API.
 */
export const deleteDomainTableItem = async (
  integrationKey: string,
  resource: string,
  id: string,
) => {
  const { page, baseUrl } = await getDashboardPage(integrationKey, resource);
  return callDomain(`${baseUrl}${page.apiPrefix}/${id}`, (value) => value, {
    method: "DELETE",
  });
};
