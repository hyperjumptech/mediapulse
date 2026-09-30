import {
  createDomainIntegrationClient,
  tableV1ListResponseSchema,
  tableV1MetaResponseSchema,
} from "@hermes/domain-contract";
import type {
  PreviewExpansionResponse,
  TableV1MetaResponse,
} from "@hermes/domain-contract";
import { z } from "zod";

import { getBearerJwtForDomainIntegrationId } from "@/lib/domain-integration-auth-token";
import {
  DomainIntegrationTimeoutError,
  requestDomainIntegration,
} from "@/lib/domain-integration-request";
import {
  domainRequestFailedError,
  readDomainErrorDetail,
} from "@/lib/domain-request-error";
import {
  getDomainIntegrationByIntegrationId,
  type DomainIntegrationRecord,
} from "@/lib/domain-integrations";
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

const DOMAIN_ROW_ID_PAGE_SIZE = 100;

const DOMAIN_TABLE_META_CACHE_TTL_MS = 5 * 60 * 1000;

const DOMAIN_TABLE_META_CACHE_MAX_ENTRIES = 200;

type DomainRequestTarget = Pick<
  DomainIntegrationRecord,
  "id" | "integrationId"
>;

type DomainTableMetaCacheEntry = {
  expiresAt: number;
  meta: Promise<TableV1MetaResponse>;
};

const domainTableMetaCache = new Map<string, DomainTableMetaCacheEntry>();

const JSON_CONTENT_TYPE_HEADERS = { "Content-Type": "application/json" };

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
  /** Filter query params forwarded generically to the domain list API. */
  filters?: Record<string, string>;
};

const requireActiveDomainIntegration = async (
  integrationId: string,
): Promise<DomainIntegrationRecord> => {
  const integration = await getDomainIntegrationByIntegrationId(integrationId);
  if (!integration) {
    throw new Error(
      `Domain integration "${integrationId}" is not active or not registered`,
    );
  }

  return integration;
};

const requireDataSourceExpansionsSupport = (
  integration: DomainIntegrationRecord,
  resource: string,
): void => {
  if (
    !integrationSupportsHermesDataSourceExpansionTemplates(
      integration.capabilities,
    )
  ) {
    throw new Error(
      `Dashboard page "${resource}" is not registered for integration "${integration.integrationId}"`,
    );
  }
};

const resolveDashboardPage = (
  integration: DomainIntegrationRecord,
  resource: string,
): {
  page: {
    apiPrefix: string;
    pathSegment: string;
  };
  baseUrl: string;
  domainIntegrationId: string;
} => {
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

  const page = integration.dashboard.views.find(
    (entry) =>
      entry.placement === "sidebar" &&
      entry.pathSegment === resource &&
      entry.kind === "resource-table",
  );

  if (!page || page.kind !== "resource-table") {
    throw new Error(
      `Dashboard resource-table view "${resource}" is not registered for integration "${integration.integrationId}"`,
    );
  }

  return {
    page,
    baseUrl: integration.baseUrl.replace(/\/$/, ""),
    domainIntegrationId: integration.id,
  };
};

/**
 * Resolves a dashboard page from a specific domain integration manifest.
 *
 * @param integrationId - Registered integration id (URL segment).
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
  const integration = await requireActiveDomainIntegration(integrationId);

  return resolveDashboardPage(integration, resource);
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
  target: DomainRequestTarget,
): Promise<T> => {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");

  return requestDomainIntegration(
    {
      url: input,
      domainIntegrationId: target.id,
      integrationLabel: target.integrationId,
      init: { ...init, headers },
    },
    async (response) => {
      if (!response.ok) {
        const detail = await readDomainErrorDetail(response);
        throw domainRequestFailedError(response.status, detail);
      }
      const payload = (await response.json()) as unknown;

      return parser(payload);
    },
  );
};

const buildDomainTableMetaCacheKey = (
  integration: DomainIntegrationRecord,
  resource: string,
): string => {
  const integrationVersion = integration.version ?? "";
  const integrationUpdatedAt = integration.updatedAt.getTime();

  return `${integration.id}:${integrationVersion}:${integrationUpdatedAt}:${resource}`;
};

const evictOldestDomainTableMetaEntries = (): void => {
  while (domainTableMetaCache.size > DOMAIN_TABLE_META_CACHE_MAX_ENTRIES) {
    const oldestCacheKey = domainTableMetaCache.keys().next().value;
    if (oldestCacheKey === undefined) {
      return;
    }
    domainTableMetaCache.delete(oldestCacheKey);
  }
};

const loadDomainTableMetaCached = async (
  integration: DomainIntegrationRecord,
  resource: string,
  loadMeta: () => Promise<TableV1MetaResponse>,
): Promise<TableV1MetaResponse> => {
  const cacheKey = buildDomainTableMetaCacheKey(integration, resource);
  const now = Date.now();
  const cachedEntry = domainTableMetaCache.get(cacheKey);
  if (cachedEntry && cachedEntry.expiresAt > now) {
    const cachedMeta = await cachedEntry.meta;

    return structuredClone(cachedMeta);
  }

  const entry: DomainTableMetaCacheEntry = {
    expiresAt: now + DOMAIN_TABLE_META_CACHE_TTL_MS,
    meta: loadMeta(),
  };
  domainTableMetaCache.delete(cacheKey);
  domainTableMetaCache.set(cacheKey, entry);
  evictOldestDomainTableMetaEntries();

  try {
    const loadedMeta = await entry.meta;

    return structuredClone(loadedMeta);
  } catch (error) {
    if (domainTableMetaCache.get(cacheKey) === entry) {
      domainTableMetaCache.delete(cacheKey);
    }
    throw error;
  }
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
  const integration = await requireActiveDomainIntegration(integrationId);
  if (resource === DATA_SOURCE_EXPANSIONS_PATH_SEGMENT) {
    requireDataSourceExpansionsSupport(integration, resource);

    return getDataSourceExpansionTemplateTableMeta();
  }

  const { page, baseUrl } = resolveDashboardPage(integration, resource);
  const metaUrl = `${baseUrl}${page.apiPrefix}/meta`;

  return loadDomainTableMetaCached(integration, resource, () =>
    callDomain(
      metaUrl,
      tableV1MetaResponseSchema.parse,
      undefined,
      integration,
    ),
  );
};

type CallDomainCustomPostResult =
  | { ok: true; data: unknown }
  | { ok: false; message: string };

const readDomainCustomPostResult = async (
  response: Response,
): Promise<CallDomainCustomPostResult> => {
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
  try {
    return await requestDomainIntegration(
      {
        url,
        domainIntegrationId,
        integrationLabel: domainIntegrationId,
        init: {
          method: "POST",
          headers: JSON_CONTENT_TYPE_HEADERS,
          body: JSON.stringify(body),
        },
        fetchImpl,
      },
      readDomainCustomPostResult,
    );
  } catch (error) {
    if (error instanceof DomainIntegrationTimeoutError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
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
  const integration = await requireActiveDomainIntegration(integrationId);
  if (resource === DATA_SOURCE_EXPANSIONS_PATH_SEGMENT) {
    requireDataSourceExpansionsSupport(integration, resource);

    return listDataSourceExpansionTemplatesForIntegration(
      integrationId,
      params,
    );
  }

  const { page, baseUrl } = resolveDashboardPage(integration, resource);
  const search = new URLSearchParams();
  search.set("page", String(params.page));
  search.set("pageSize", String(params.pageSize));
  if (params.query) search.set("q", params.query);
  if (params.sortBy) search.set("sortBy", params.sortBy);
  if (params.sortDir) search.set("sortDir", params.sortDir);
  for (const [key, value] of Object.entries(params.filters ?? {})) {
    if (value) search.set(key, value);
  }

  return callDomain(
    `${baseUrl}${page.apiPrefix}?${search.toString()}`,
    tableV1ListResponseSchema.parse,
    undefined,
    integration,
  );
};

/**
 * Resolves base URL and API prefix for a domain table-v1 list endpoint.
 *
 * @param integrationId - Registered domain integration id.
 * @param resource - Manifest `pathSegment` for the list resource.
 * @returns Base URL without trailing slash and path prefix for GET list requests.
 */
export const resolveDomainTableListUrl = async (
  integrationId: string,
  resource: string,
): Promise<{
  baseUrl: string;
  apiPrefix: string;
  domainIntegrationId: string;
}> => {
  const { page, baseUrl, domainIntegrationId } = await getDashboardPage(
    integrationId,
    resource,
  );
  return { baseUrl, apiPrefix: page.apiPrefix, domainIntegrationId };
};

export type FetchAllDomainTableIdsForPipelineRunDependencies = {
  /** Resolves HTTP base URL and path for a table-v1 list (inject in tests). */
  resolveUrl?: typeof resolveDomainTableListUrl;
};

/**
 * Loads every row id from a domain table-v1 list via HTTP (paginated).
 *
 * @param integrationId - Registered domain integration id.
 * @param resource - Manifest `pathSegment` for the list resource.
 * @param dependencies - Optional `resolveUrl` override for tests.
 * @returns Rows with string ids from the domain list API.
 */
export const fetchAllDomainTableIdsForPipelineRun = async (
  integrationId: string,
  resource: string,
  dependencies: FetchAllDomainTableIdsForPipelineRunDependencies = {},
): Promise<Array<{ id: string }>> => {
  const resolveUrl = dependencies.resolveUrl ?? resolveDomainTableListUrl;
  const { baseUrl, apiPrefix, domainIntegrationId } = await resolveUrl(
    integrationId,
    resource,
  );
  const target: DomainRequestTarget = {
    id: domainIntegrationId,
    integrationId,
  };
  const all: Array<{ id: string }> = [];
  let page = 1;

  while (true) {
    const search = new URLSearchParams();
    search.set("page", String(page));
    search.set("pageSize", String(DOMAIN_ROW_ID_PAGE_SIZE));

    const payload = await callDomain(
      `${baseUrl}${apiPrefix}?${search.toString()}`,
      tableV1ListResponseSchema.parse,
      undefined,
      target,
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
    if (page * DOMAIN_ROW_ID_PAGE_SIZE >= payload.total) {
      break;
    }
    page += 1;
  }

  return all;
};

const domainTableItemResponseSchema = z.record(z.string(), z.unknown());

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
  const integration = await requireActiveDomainIntegration(integrationId);
  if (resource === DATA_SOURCE_EXPANSIONS_PATH_SEGMENT) {
    requireDataSourceExpansionsSupport(integration, resource);

    return getDataSourceExpansionTemplateByIdForIntegration(integrationId, id);
  }

  const { page, baseUrl } = resolveDashboardPage(integration, resource);

  return requestDomainIntegration(
    {
      url: `${baseUrl}${page.apiPrefix}/${id}`,
      domainIntegrationId: integration.id,
      integrationLabel: integration.integrationId,
      init: { headers: JSON_CONTENT_TYPE_HEADERS },
    },
    async (response) => {
      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Domain dashboard request failed (${response.status})`);
      }

      const payload = (await response.json()) as unknown;

      return domainTableItemResponseSchema.parse(payload);
    },
  );
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
  const integration = await requireActiveDomainIntegration(integrationId);
  if (resource === DATA_SOURCE_EXPANSIONS_PATH_SEGMENT) {
    requireDataSourceExpansionsSupport(integration, resource);

    return createDataSourceExpansionTemplateForIntegration(integrationId, body);
  }

  const { page, baseUrl } = resolveDashboardPage(integration, resource);

  return callDomain(
    `${baseUrl}${page.apiPrefix}`,
    (value) => value,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    integration,
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
  const integration = await requireActiveDomainIntegration(integrationId);
  if (resource === DATA_SOURCE_EXPANSIONS_PATH_SEGMENT) {
    requireDataSourceExpansionsSupport(integration, resource);

    return updateDataSourceExpansionTemplateForIntegration(
      integrationId,
      id,
      body,
    );
  }

  const { page, baseUrl } = resolveDashboardPage(integration, resource);

  return callDomain(
    `${baseUrl}${page.apiPrefix}/${id}`,
    (value) => value,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
    integration,
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
  const integration = await requireActiveDomainIntegration(integrationId);
  if (resource === DATA_SOURCE_EXPANSIONS_PATH_SEGMENT) {
    requireDataSourceExpansionsSupport(integration, resource);
    await deleteDataSourceExpansionTemplateForIntegration(integrationId, id);

    return { ok: true };
  }

  const { page, baseUrl } = resolveDashboardPage(integration, resource);

  return callDomain(
    `${baseUrl}${page.apiPrefix}/${id}`,
    (value) => value,
    {
      method: "DELETE",
    },
    integration,
  );
};

const PROCESSED_URLS_PATH = "/hermes-dashboard/processed-urls";

const optionalProcessedUrlText = z
  .string()
  .nullable()
  .optional()
  .catch(undefined);

const processedUrlSubjectSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

const processedUrlItemSchema = z.object({
  id: z.string(),
  subject: processedUrlSubjectSchema.nullable().optional().catch(undefined),
  agent: z.string(),
  url: z.string(),
  status: z.string(),
  reason: optionalProcessedUrlText,
  reasonDetail: optionalProcessedUrlText,
  source: optionalProcessedUrlText,
  createdAt: z.string(),
});

const processedUrlsListResponseSchema = z.object({
  items: z.array(processedUrlItemSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  subjectTitle: z.string().min(1).optional().catch(undefined),
});

export type ProcessedUrlSubject = z.infer<typeof processedUrlSubjectSchema>;

export type ProcessedUrlItem = z.infer<typeof processedUrlItemSchema>;

export type ProcessedUrlsListResponse = z.infer<
  typeof processedUrlsListResponseSchema
>;

const parseProcessedUrlsListResponse = (
  value: unknown,
): ProcessedUrlsListResponse => {
  const parsed = processedUrlsListResponseSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("Invalid processed-urls response shape");
  }

  return parsed.data;
};

export type FetchProcessedUrlsParams = {
  integrationId: string;
  scheduleExecutionId: string;
  page: number;
  pageSize: number;
  subjectId?: string;
  agent?: string;
  status?: string;
  gateStatus?: string;
};

const buildProcessedUrlsSearch = (
  query: Omit<FetchProcessedUrlsParams, "integrationId">,
): URLSearchParams => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }

  return search;
};

export const fetchProcessedUrlsForExecution = async ({
  integrationId,
  ...query
}: FetchProcessedUrlsParams): Promise<ProcessedUrlsListResponse> => {
  const integration = await requireActiveDomainIntegration(integrationId);
  const baseUrl = integration.baseUrl.replace(/\/$/, "");
  const search = buildProcessedUrlsSearch(query);

  return callDomain(
    `${baseUrl}/v1${PROCESSED_URLS_PATH}?${search.toString()}`,
    parseProcessedUrlsListResponse,
    undefined,
    integration,
  );
};
