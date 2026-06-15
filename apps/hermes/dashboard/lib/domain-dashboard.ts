import {
  createDomainIntegrationClient,
  tableV1ListResponseSchema,
  tableV1MetaResponseSchema,
} from "@hermes/domain-contract";
import type { PreviewExpansionResponse } from "@hermes/domain-contract";
import { z } from "zod";

import { getBearerJwtForDomainIntegrationId } from "@/lib/domain-integration-auth-token";
import { getDomainIntegrationByIntegrationId } from "@/lib/domain-integrations";
import {
  createDataSourceExpansionTemplateForIntegration,
  deleteDataSourceExpansionTemplateForIntegration,
  getDataSourceExpansionTemplateByIdForIntegration,
  integrationSupportsHermesDataSourceExpansionTemplates,
  listDataSourceExpansionTemplatesForIntegration,
  updateDataSourceExpansionTemplateForIntegration,
} from "@/lib/data-source-expansion-templates";
import {
  DATA_SOURCE_EXPANSIONS_PATH_SEGMENT,
  getDataSourceExpansionTemplateTableMeta,
  hermesDataSourceExpansionsManifestApiPrefix,
} from "@/lib/data-source-expansion-template-meta";

/** Page size for pipeline ticker fetch; must not exceed domain-api `MAX_PAGE_SIZE` (100). */
const PIPELINE_TICKER_PAGE_SIZE = 100;

/** Dashboard path segment for the mediapulse tickers table-v1 resource. */
const TICKERS_RESOURCE = "tickers";

/** Result state for JSON file custom actions (e.g. IDX import) returned from server actions. */
export type DomainTableJsonImportState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; added: number; updated: number };

/** Result state for danger-confirm custom actions (e.g. reset all relations). */
export type DomainTableDangerConfirmState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; deleted: number };

export type DomainTableListParams = {
  page: number;
  pageSize: number;
  query?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  tickerId?: string;
  typeId?: string;
  from?: string;
  to?: string;
  intent?: string;
  source?: string;
  collectionSource?: string;
  isActive?: string;
};

/**
 * Resolves a dashboard page from a specific domain integration manifest.
 *
 * @param integrationId - Registered integration id (e.g. "mediapulse", URL segment).
 * @param resource - Dashboard path segment (matches manifest `pathSegment`).
 * @returns Domain page descriptor and base URL.
 */
export const getDashboardPage = async (
  integrationId: string,
  resource: string,
): Promise<{
  page: {
    apiPrefix: string;
    pathSegment: string;
  };
  baseUrl: string;
  /** Orchestration `domain_integration.id` (UUID); used for JWT minting. */
  domainIntegrationId: string;
}> => {
  const integration = await getDomainIntegrationByIntegrationId(integrationId);
  if (!integration) {
    throw new Error(
      `Domain integration "${integrationId}" is not active or not registered`,
    );
  }

  if (
    resource === DATA_SOURCE_EXPANSIONS_PATH_SEGMENT &&
    integrationSupportsHermesDataSourceExpansionTemplates(
      integration.capabilities,
    )
  ) {
    return {
      page: {
        apiPrefix: hermesDataSourceExpansionsManifestApiPrefix(),
        pathSegment: DATA_SOURCE_EXPANSIONS_PATH_SEGMENT,
      },
      baseUrl: integration.baseUrl.replace(/\/$/, ""),
      domainIntegrationId: integration.id,
    };
  }

  const page = integration.dashboard.pages.find(
    (entry) => entry.pathSegment === resource,
  );

  if (!page) {
    throw new Error(
      `Dashboard page "${resource}" is not registered for integration "${integrationId}"`,
    );
  }

  return {
    page,
    baseUrl: integration.baseUrl.replace(/\/$/, ""),
    domainIntegrationId: integration.id,
  };
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
  init: RequestInit | undefined,
  domainIntegrationId: string,
): Promise<T> => {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const jwt = await getBearerJwtForDomainIntegrationId(domainIntegrationId);
  if (jwt) {
    headers.set("Authorization", `Bearer ${jwt}`);
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
 * @param integrationId - Registered integration id (URL segment).
 * @param resource - Dashboard path segment.
 * @returns Meta configuration used to render the page.
 */
export const getDomainTableMeta = async (
  integrationId: string,
  resource: string,
) => {
  if (resource === DATA_SOURCE_EXPANSIONS_PATH_SEGMENT) {
    const integration =
      await getDomainIntegrationByIntegrationId(integrationId);
    if (!integration) {
      throw new Error(
        `Domain integration "${integrationId}" is not active or not registered`,
      );
    }
    if (
      !integrationSupportsHermesDataSourceExpansionTemplates(
        integration.capabilities,
      )
    ) {
      throw new Error(
        `Dashboard page "${resource}" is not registered for integration "${integrationId}"`,
      );
    }
    return getDataSourceExpansionTemplateTableMeta();
  }

  const { page, baseUrl, domainIntegrationId } = await getDashboardPage(
    integrationId,
    resource,
  );
  return callDomain(
    `${baseUrl}${page.apiPrefix}/meta`,
    tableV1MetaResponseSchema.parse,
    undefined,
    domainIntegrationId,
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
  domainIntegrationId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CallDomainCustomPostResult> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const jwt = await getBearerJwtForDomainIntegrationId(domainIntegrationId);
  if (jwt) {
    headers.Authorization = `Bearer ${jwt}`;
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
 * @param integrationId - Registered integration id (URL segment).
 * @param resource - Dashboard path segment.
 * @param actionId - Custom action `id` from manifest/meta.
 * @param payloadJson - Raw JSON file contents as a string (validated by the domain service).
 * @param dependencies - Optional collaborators for tests.
 * @returns Success with parsed response data or failure with message.
 */
export const invokeDomainTableCustomAction = async (
  integrationId: string,
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

  const meta = await getMeta(integrationId, resource);
  const action = meta.customActions.find((entry) => entry.id === actionId);
  if (!action) {
    return { success: false, message: "Unknown custom action" };
  }
  if (action.ui !== "json-file-upload" || action.method !== "POST") {
    return { success: false, message: "Unsupported custom action" };
  }

  const { page, baseUrl, domainIntegrationId } = await getPage(
    integrationId,
    resource,
  );
  const url = `${baseUrl}${page.apiPrefix}${action.path}`;
  const result = await callPost(url, { payloadJson }, domainIntegrationId);

  if (!result.ok) {
    return { success: false, message: result.message };
  }

  return { success: true, data: result.data };
};

export type InvokeDomainTableDangerConfirmActionDependencies = {
  getMeta?: typeof getDomainTableMeta;
  getPage?: typeof getDashboardPage;
  callPost?: typeof callDomainCustomPost;
};

/**
 * Invokes a danger-confirm table-v1 custom action (POST with confirm token).
 *
 * @param integrationId - Registered integration id (URL segment).
 * @param resource - Dashboard path segment.
 * @param actionId - Custom action `id` from manifest/meta.
 * @param dependencies - Optional collaborators for tests.
 * @returns Success with parsed response data or failure with message.
 */
export const invokeDomainTableDangerConfirmAction = async (
  integrationId: string,
  resource: string,
  actionId: string,
  dependencies: InvokeDomainTableDangerConfirmActionDependencies = {},
): Promise<
  { success: true; data: unknown } | { success: false; message: string }
> => {
  const getMeta = dependencies.getMeta ?? getDomainTableMeta;
  const getPage = dependencies.getPage ?? getDashboardPage;
  const callPost = dependencies.callPost ?? callDomainCustomPost;

  const meta = await getMeta(integrationId, resource);
  const action = meta.customActions.find((entry) => entry.id === actionId);
  if (!action) {
    return { success: false, message: "Unknown custom action" };
  }
  if (action.ui !== "danger-confirm" || action.method !== "POST") {
    return { success: false, message: "Unsupported custom action" };
  }
  if (!action.confirmToken) {
    return {
      success: false,
      message: "Custom action is missing confirm token",
    };
  }

  const { page, baseUrl, domainIntegrationId } = await getPage(
    integrationId,
    resource,
  );
  const url = `${baseUrl}${page.apiPrefix}${action.path}`;
  const result = await callPost(
    url,
    { confirm: action.confirmToken },
    domainIntegrationId,
  );

  if (!result.ok) {
    return { success: false, message: result.message };
  }

  return { success: true, data: result.data };
};

/**
 * Loads table-v1 list data for a dashboard resource.
 *
 * @param integrationId - Registered integration id (URL segment).
 * @param resource - Dashboard path segment.
 * @param params - Pagination, search, and sort params.
 * @returns Paginated list payload.
 */
export const getDomainTableList = async (
  integrationId: string,
  resource: string,
  params: DomainTableListParams,
) => {
  if (resource === DATA_SOURCE_EXPANSIONS_PATH_SEGMENT) {
    const integration =
      await getDomainIntegrationByIntegrationId(integrationId);
    if (!integration) {
      throw new Error(
        `Domain integration "${integrationId}" is not active or not registered`,
      );
    }
    if (
      !integrationSupportsHermesDataSourceExpansionTemplates(
        integration.capabilities,
      )
    ) {
      throw new Error(
        `Dashboard page "${resource}" is not registered for integration "${integrationId}"`,
      );
    }
    return listDataSourceExpansionTemplatesForIntegration(
      integrationId,
      params,
    );
  }

  const { page, baseUrl, domainIntegrationId } = await getDashboardPage(
    integrationId,
    resource,
  );
  const search = new URLSearchParams();
  search.set("page", String(params.page));
  search.set("pageSize", String(params.pageSize));
  if (params.query) search.set("q", params.query);
  if (params.sortBy) search.set("sortBy", params.sortBy);
  if (params.sortDir) search.set("sortDir", params.sortDir);
  if (params.tickerId) search.set("tickerId", params.tickerId);
  if (params.typeId) search.set("typeId", params.typeId);
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  if (params.intent) search.set("intent", params.intent);
  if (params.source) search.set("source", params.source);
  if (params.collectionSource) {
    search.set("collectionSource", params.collectionSource);
  }
  if (params.isActive) search.set("isActive", params.isActive);

  return callDomain(
    `${baseUrl}${page.apiPrefix}?${search.toString()}`,
    tableV1ListResponseSchema.parse,
    undefined,
    domainIntegrationId,
  );
};

/**
 * Resolves base URL and API prefix for the mediapulse tickers table-v1 list endpoint from the registered integration manifest.
 *
 * @returns Base URL without trailing slash and path prefix for GET list requests.
 */
const resolveMediapulseTickersListUrl = async (): Promise<{
  baseUrl: string;
  apiPrefix: string;
  domainIntegrationId: string;
}> => {
  const { page, baseUrl, domainIntegrationId } = await getDashboardPage(
    "mediapulse",
    TICKERS_RESOURCE,
  );
  return { baseUrl, apiPrefix: page.apiPrefix, domainIntegrationId };
};

export type FetchAllTickersForPipelineRunDependencies = {
  /** Resolves HTTP base URL and path for tickers list (inject in tests). */
  resolveUrl?: typeof resolveMediapulseTickersListUrl;
};

/**
 * Loads every ticker id from the domain integration via the table-v1 HTTP API (paginated).
 * Used by Hermes pipeline run so the dashboard does not depend on `@mediapulse/database`.
 *
 * @param dependencies - Optional `resolveUrl` override for tests.
 * @returns Ticker rows with string ids suitable for agent `tickerId` payloads.
 */
export const fetchAllTickersForPipelineRun = async (
  dependencies: FetchAllTickersForPipelineRunDependencies = {},
): Promise<Array<{ id: string }>> => {
  const resolveUrl = dependencies.resolveUrl ?? resolveMediapulseTickersListUrl;
  const { baseUrl, apiPrefix, domainIntegrationId } = await resolveUrl();
  const all: Array<{ id: string }> = [];
  let page = 1;

  while (true) {
    const search = new URLSearchParams();
    search.set("page", String(page));
    search.set("pageSize", String(PIPELINE_TICKER_PAGE_SIZE));

    const payload = await callDomain(
      `${baseUrl}${apiPrefix}?${search.toString()}`,
      tableV1ListResponseSchema.parse,
      undefined,
      domainIntegrationId,
    );

    for (const item of payload.items) {
      const id = item.id;
      if (typeof id === "string" && id.length > 0) {
        all.push({ id });
      }
    }

    if (payload.items.length === 0) {
      break;
    }
    if (page * PIPELINE_TICKER_PAGE_SIZE >= payload.total) {
      break;
    }
    page += 1;
  }

  return all;
};

const domainTableItemResponseSchema = z.record(z.unknown());

/**
 * Loads a single table-v1 row by id when the domain API exposes GET `{apiPrefix}/{id}`.
 *
 * @param integrationId - Registered integration id (URL segment).
 * @param resource - Dashboard path segment.
 * @param id - Row id.
 * @returns Parsed row or null when the domain returns 404.
 */
export const getDomainTableItemById = async (
  integrationId: string,
  resource: string,
  id: string,
): Promise<Record<string, unknown> | null> => {
  if (resource === DATA_SOURCE_EXPANSIONS_PATH_SEGMENT) {
    const integration =
      await getDomainIntegrationByIntegrationId(integrationId);
    if (!integration) {
      throw new Error(
        `Domain integration "${integrationId}" is not active or not registered`,
      );
    }
    if (
      !integrationSupportsHermesDataSourceExpansionTemplates(
        integration.capabilities,
      )
    ) {
      throw new Error(
        `Dashboard page "${resource}" is not registered for integration "${integrationId}"`,
      );
    }
    return getDataSourceExpansionTemplateByIdForIntegration(integrationId, id);
  }

  const { page, baseUrl, domainIntegrationId } = await getDashboardPage(
    integrationId,
    resource,
  );
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  const jwt = await getBearerJwtForDomainIntegrationId(domainIntegrationId);
  if (jwt) {
    headers.set("Authorization", `Bearer ${jwt}`);
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
  getIntegration?: typeof getDomainIntegrationByIntegrationId;
  createClient?: typeof createDomainIntegrationClient;
};

/**
 * Calls the domain integration `preview-expansion` endpoint for a single expansion string.
 *
 * @param integrationId - Registered integration id (URL segment).
 * @param expansionString - Value to preview (e.g. db:table:field).
 * @param dependencies - Optional collaborators for tests.
 * @returns Parsed preview response from the domain contract.
 */
export const previewDomainExpansion = async (
  integrationId: string,
  expansionString: string,
  dependencies: PreviewDomainExpansionDependencies = {},
): Promise<PreviewExpansionResponse> => {
  const getIntegration =
    dependencies.getIntegration ?? getDomainIntegrationByIntegrationId;
  const createClient =
    dependencies.createClient ?? createDomainIntegrationClient;

  const integration = await getIntegration(integrationId);
  if (!integration) {
    throw new Error(
      `Domain integration "${integrationId}" is not active or not registered`,
    );
  }
  if (!integration.capabilities.includes("preview-expansion")) {
    throw new Error(
      `Domain integration "${integrationId}" does not support preview-expansion`,
    );
  }

  const client = createClient({
    baseUrl: integration.baseUrl,
    authToken: await getBearerJwtForDomainIntegrationId(integration.id),
  });

  return client.previewExpansion({ expansionString });
};

/**
 * Creates a domain table row through the registered API prefix.
 *
 * @param integrationId - Registered integration id (URL segment).
 * @param resource - Dashboard path segment.
 * @param body - JSON payload from create form.
 * @returns Parsed response payload from the domain API.
 */
export const createDomainTableItem = async (
  integrationId: string,
  resource: string,
  body: Record<string, unknown>,
) => {
  if (resource === DATA_SOURCE_EXPANSIONS_PATH_SEGMENT) {
    const integration =
      await getDomainIntegrationByIntegrationId(integrationId);
    if (!integration) {
      throw new Error(
        `Domain integration "${integrationId}" is not active or not registered`,
      );
    }
    if (
      !integrationSupportsHermesDataSourceExpansionTemplates(
        integration.capabilities,
      )
    ) {
      throw new Error(
        `Dashboard page "${resource}" is not registered for integration "${integrationId}"`,
      );
    }
    return createDataSourceExpansionTemplateForIntegration(integrationId, body);
  }

  const { page, baseUrl, domainIntegrationId } = await getDashboardPage(
    integrationId,
    resource,
  );
  return callDomain(
    `${baseUrl}${page.apiPrefix}`,
    (value) => value,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    domainIntegrationId,
  );
};

/**
 * Updates a domain table row through the registered API prefix.
 *
 * @param integrationId - Registered integration id (URL segment).
 * @param resource - Dashboard path segment.
 * @param id - Row identifier.
 * @param body - JSON payload from update form.
 * @returns Parsed response payload from the domain API.
 */
export const updateDomainTableItem = async (
  integrationId: string,
  resource: string,
  id: string,
  body: Record<string, unknown>,
) => {
  if (resource === DATA_SOURCE_EXPANSIONS_PATH_SEGMENT) {
    const integration =
      await getDomainIntegrationByIntegrationId(integrationId);
    if (!integration) {
      throw new Error(
        `Domain integration "${integrationId}" is not active or not registered`,
      );
    }
    if (
      !integrationSupportsHermesDataSourceExpansionTemplates(
        integration.capabilities,
      )
    ) {
      throw new Error(
        `Dashboard page "${resource}" is not registered for integration "${integrationId}"`,
      );
    }
    return updateDataSourceExpansionTemplateForIntegration(
      integrationId,
      id,
      body,
    );
  }

  const { page, baseUrl, domainIntegrationId } = await getDashboardPage(
    integrationId,
    resource,
  );
  return callDomain(
    `${baseUrl}${page.apiPrefix}/${id}`,
    (value) => value,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
    domainIntegrationId,
  );
};

/**
 * Deletes a domain table row through the registered API prefix.
 *
 * @param integrationId - Registered integration id (URL segment).
 * @param resource - Dashboard path segment.
 * @param id - Row identifier.
 * @returns Parsed response payload from the domain API.
 */
export const deleteDomainTableItem = async (
  integrationId: string,
  resource: string,
  id: string,
) => {
  if (resource === DATA_SOURCE_EXPANSIONS_PATH_SEGMENT) {
    const integration =
      await getDomainIntegrationByIntegrationId(integrationId);
    if (!integration) {
      throw new Error(
        `Domain integration "${integrationId}" is not active or not registered`,
      );
    }
    if (
      !integrationSupportsHermesDataSourceExpansionTemplates(
        integration.capabilities,
      )
    ) {
      throw new Error(
        `Dashboard page "${resource}" is not registered for integration "${integrationId}"`,
      );
    }
    await deleteDataSourceExpansionTemplateForIntegration(integrationId, id);
    return { ok: true };
  }

  const { page, baseUrl, domainIntegrationId } = await getDashboardPage(
    integrationId,
    resource,
  );
  return callDomain(
    `${baseUrl}${page.apiPrefix}/${id}`,
    (value) => value,
    {
      method: "DELETE",
    },
    domainIntegrationId,
  );
};

/** Mediapulse integration id used for processed-URL lookups. */
const MEDIAPULSE_INTEGRATION_ID = "mediapulse";

/** Domain-api path for the processed-urls endpoint (relative to `/v1`). */
const PROCESSED_URLS_PATH = "/hermes-dashboard/processed-urls";

/** Response item shape returned by the processed-urls domain-api endpoint. */
export type ProcessedUrlItem = {
  id: string;
  tickerSymbol: string;
  agent: string;
  url: string;
  status: string;
  reason: string | null;
  reasonDetail: string | null;
  source: string | null;
  createdAt: string;
};

/** Paginated response from the processed-urls domain-api endpoint. */
export type ProcessedUrlsListResponse = {
  items: ProcessedUrlItem[];
  total: number;
  page: number;
  pageSize: number;
};

const processedUrlsListResponseSchema = (
  value: unknown,
): ProcessedUrlsListResponse => {
  if (
    typeof value !== "object" ||
    value === null ||
    !Array.isArray((value as { items?: unknown }).items) ||
    typeof (value as { total?: unknown }).total !== "number" ||
    typeof (value as { page?: unknown }).page !== "number" ||
    typeof (value as { pageSize?: unknown }).pageSize !== "number"
  ) {
    throw new Error("Invalid processed-urls response shape");
  }
  return value as ProcessedUrlsListResponse;
};

/** Query params for {@link fetchProcessedUrlsForExecution}. */
export type FetchProcessedUrlsParams = {
  scheduleExecutionId: string;
  page?: number;
  pageSize?: number;
  tickerId?: string;
  agent?: string;
  status?: string;
};

/**
 * Fetches paginated processed-URL outcomes for a given schedule execution from the mediapulse domain-api.
 *
 * @param params - Required `scheduleExecutionId` plus optional filters and pagination.
 * @returns Paginated list of processed-URL outcome items.
 */
export const fetchProcessedUrlsForExecution = async (
  params: FetchProcessedUrlsParams,
): Promise<ProcessedUrlsListResponse> => {
  const integration = await getDomainIntegrationByIntegrationId(
    MEDIAPULSE_INTEGRATION_ID,
  );
  if (!integration) {
    throw new Error(
      "Mediapulse domain integration is not active or not registered",
    );
  }

  const baseUrl = integration.baseUrl.replace(/\/$/, "");
  const domainIntegrationId = integration.id;

  const search = new URLSearchParams();
  search.set("scheduleExecutionId", params.scheduleExecutionId);
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.pageSize !== undefined)
    search.set("pageSize", String(params.pageSize));
  if (params.tickerId) search.set("tickerId", params.tickerId);
  if (params.agent) search.set("agent", params.agent);
  if (params.status) search.set("status", params.status);

  return callDomain(
    `${baseUrl}/v1${PROCESSED_URLS_PATH}?${search.toString()}`,
    processedUrlsListResponseSchema,
    undefined,
    domainIntegrationId,
  );
};
