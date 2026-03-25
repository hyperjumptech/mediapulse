import {
  createDomainIntegrationClient,
  tableV1ListResponseSchema,
  tableV1MetaResponseSchema,
} from "@hermes/domain-contract";
import type { PreviewExpansionResponse } from "@hermes/domain-contract";
import { z } from "zod";

import { getBearerJwtForDomainIntegrationId } from "@/lib/domain-integration-auth-token";
import { getDomainIntegrationByKey } from "@/lib/domain-integrations";
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
export const getDashboardPage = async (
  integrationKey: string,
  resource: string,
): Promise<{
  page: {
    apiPrefix: string;
    pathSegment: string;
  };
  baseUrl: string;
  integrationId: string;
}> => {
  const integration = await getDomainIntegrationByKey(integrationKey);
  if (!integration) {
    throw new Error(
      `Domain integration "${integrationKey}" is not active or not registered`,
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
      integrationId: integration.id,
    };
  }

  const page = integration.dashboard.pages.find(
    (entry) => entry.pathSegment === resource,
  );

  if (!page) {
    throw new Error(
      `Dashboard page "${resource}" is not registered for integration "${integrationKey}"`,
    );
  }

  return {
    page,
    baseUrl: integration.baseUrl.replace(/\/$/, ""),
    integrationId: integration.id,
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
 * @param integrationKey - Registered integration key.
 * @param resource - Dashboard path segment.
 * @returns Meta configuration used to render the page.
 */
export const getDomainTableMeta = async (
  integrationKey: string,
  resource: string,
) => {
  if (resource === DATA_SOURCE_EXPANSIONS_PATH_SEGMENT) {
    const integration = await getDomainIntegrationByKey(integrationKey);
    if (!integration) {
      throw new Error(
        `Domain integration "${integrationKey}" is not active or not registered`,
      );
    }
    if (
      !integrationSupportsHermesDataSourceExpansionTemplates(
        integration.capabilities,
      )
    ) {
      throw new Error(
        `Dashboard page "${resource}" is not registered for integration "${integrationKey}"`,
      );
    }
    return getDataSourceExpansionTemplateTableMeta();
  }

  const { page, baseUrl, integrationId } = await getDashboardPage(
    integrationKey,
    resource,
  );
  return callDomain(
    `${baseUrl}${page.apiPrefix}/meta`,
    tableV1MetaResponseSchema.parse,
    undefined,
    integrationId,
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

  const { page, baseUrl, integrationId } = await getPage(
    integrationKey,
    resource,
  );
  const url = `${baseUrl}${page.apiPrefix}${action.path}`;
  const result = await callPost(url, { payloadJson }, integrationId);

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
  if (resource === DATA_SOURCE_EXPANSIONS_PATH_SEGMENT) {
    const integration = await getDomainIntegrationByKey(integrationKey);
    if (!integration) {
      throw new Error(
        `Domain integration "${integrationKey}" is not active or not registered`,
      );
    }
    if (
      !integrationSupportsHermesDataSourceExpansionTemplates(
        integration.capabilities,
      )
    ) {
      throw new Error(
        `Dashboard page "${resource}" is not registered for integration "${integrationKey}"`,
      );
    }
    return listDataSourceExpansionTemplatesForIntegration(
      integrationKey,
      params,
    );
  }

  const { page, baseUrl, integrationId } = await getDashboardPage(
    integrationKey,
    resource,
  );
  const search = new URLSearchParams();
  search.set("page", String(params.page));
  search.set("pageSize", String(params.pageSize));
  if (params.query) search.set("q", params.query);
  if (params.sortBy) search.set("sortBy", params.sortBy);
  if (params.sortDir) search.set("sortDir", params.sortDir);

  return callDomain(
    `${baseUrl}${page.apiPrefix}?${search.toString()}`,
    tableV1ListResponseSchema.parse,
    undefined,
    integrationId,
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
  integrationId: string;
}> => {
  const { page, baseUrl, integrationId } = await getDashboardPage(
    "mediapulse",
    TICKERS_RESOURCE,
  );
  return { baseUrl, apiPrefix: page.apiPrefix, integrationId };
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
  const { baseUrl, apiPrefix, integrationId } = await resolveUrl();
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
      integrationId,
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
  if (resource === DATA_SOURCE_EXPANSIONS_PATH_SEGMENT) {
    const integration = await getDomainIntegrationByKey(integrationKey);
    if (!integration) {
      throw new Error(
        `Domain integration "${integrationKey}" is not active or not registered`,
      );
    }
    if (
      !integrationSupportsHermesDataSourceExpansionTemplates(
        integration.capabilities,
      )
    ) {
      throw new Error(
        `Dashboard page "${resource}" is not registered for integration "${integrationKey}"`,
      );
    }
    return getDataSourceExpansionTemplateByIdForIntegration(integrationKey, id);
  }

  const { page, baseUrl, integrationId } = await getDashboardPage(
    integrationKey,
    resource,
  );
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  const jwt = await getBearerJwtForDomainIntegrationId(integrationId);
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
    authToken: await getBearerJwtForDomainIntegrationId(integration.id),
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
  if (resource === DATA_SOURCE_EXPANSIONS_PATH_SEGMENT) {
    const integration = await getDomainIntegrationByKey(integrationKey);
    if (!integration) {
      throw new Error(
        `Domain integration "${integrationKey}" is not active or not registered`,
      );
    }
    if (
      !integrationSupportsHermesDataSourceExpansionTemplates(
        integration.capabilities,
      )
    ) {
      throw new Error(
        `Dashboard page "${resource}" is not registered for integration "${integrationKey}"`,
      );
    }
    return createDataSourceExpansionTemplateForIntegration(
      integrationKey,
      body,
    );
  }

  const { page, baseUrl, integrationId } = await getDashboardPage(
    integrationKey,
    resource,
  );
  return callDomain(
    `${baseUrl}${page.apiPrefix}`,
    (value) => value,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    integrationId,
  );
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
  if (resource === DATA_SOURCE_EXPANSIONS_PATH_SEGMENT) {
    const integration = await getDomainIntegrationByKey(integrationKey);
    if (!integration) {
      throw new Error(
        `Domain integration "${integrationKey}" is not active or not registered`,
      );
    }
    if (
      !integrationSupportsHermesDataSourceExpansionTemplates(
        integration.capabilities,
      )
    ) {
      throw new Error(
        `Dashboard page "${resource}" is not registered for integration "${integrationKey}"`,
      );
    }
    return updateDataSourceExpansionTemplateForIntegration(
      integrationKey,
      id,
      body,
    );
  }

  const { page, baseUrl, integrationId } = await getDashboardPage(
    integrationKey,
    resource,
  );
  return callDomain(
    `${baseUrl}${page.apiPrefix}/${id}`,
    (value) => value,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
    integrationId,
  );
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
  if (resource === DATA_SOURCE_EXPANSIONS_PATH_SEGMENT) {
    const integration = await getDomainIntegrationByKey(integrationKey);
    if (!integration) {
      throw new Error(
        `Domain integration "${integrationKey}" is not active or not registered`,
      );
    }
    if (
      !integrationSupportsHermesDataSourceExpansionTemplates(
        integration.capabilities,
      )
    ) {
      throw new Error(
        `Dashboard page "${resource}" is not registered for integration "${integrationKey}"`,
      );
    }
    await deleteDataSourceExpansionTemplateForIntegration(integrationKey, id);
    return { ok: true };
  }

  const { page, baseUrl, integrationId } = await getDashboardPage(
    integrationKey,
    resource,
  );
  return callDomain(
    `${baseUrl}${page.apiPrefix}/${id}`,
    (value) => value,
    {
      method: "DELETE",
    },
    integrationId,
  );
};
