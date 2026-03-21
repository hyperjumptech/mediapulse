import {
  tableV1ListResponseSchema,
  tableV1MetaResponseSchema,
} from "@hermes/domain-contract";
import { env } from "@hermes/env";

export type DomainListItem = Record<string, unknown>;

export type DomainTableListParams = {
  page: number;
  pageSize: number;
  query?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
};

/**
 * Resolves a dashboard page from the active domain integration manifest.
 *
 * @param resource - Dashboard path segment.
 * @returns Domain page descriptor and base URL.
 */
const getDashboardPage = async (resource: string) => {
  const { getDefaultDomainIntegration } =
    await import("@/lib/domain-integrations");
  const integration = await getDefaultDomainIntegration();
  const page = integration.dashboard.pages.find(
    (entry) => entry.pathSegment === resource,
  );

  if (!page) {
    throw new Error(`Dashboard page "${resource}" is not registered`);
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
 * @param resource - Dashboard path segment.
 * @returns Meta configuration used to render the page.
 */
export const getDomainTableMeta = async (resource: string) => {
  const { page, baseUrl } = await getDashboardPage(resource);
  return callDomain(
    `${baseUrl}${page.apiPrefix}/meta`,
    tableV1MetaResponseSchema.parse,
  );
};

/**
 * Loads table-v1 list data for a dashboard resource.
 *
 * @param resource - Dashboard path segment.
 * @param params - Pagination, search, and sort params.
 * @returns Paginated list payload.
 */
export const getDomainTableList = async (
  resource: string,
  params: DomainTableListParams,
) => {
  const { page, baseUrl } = await getDashboardPage(resource);
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

/**
 * Creates a domain table row through the registered API prefix.
 *
 * @param resource - Dashboard path segment.
 * @param body - JSON payload from create form.
 * @returns Nothing; throws when request fails.
 */
export const createDomainTableItem = async (
  resource: string,
  body: Record<string, unknown>,
) => {
  const { page, baseUrl } = await getDashboardPage(resource);
  await callDomain(`${baseUrl}${page.apiPrefix}`, (value) => value, {
    method: "POST",
    body: JSON.stringify(body),
  });
};

/**
 * Updates a domain table row through the registered API prefix.
 *
 * @param resource - Dashboard path segment.
 * @param id - Row identifier.
 * @param body - JSON payload from update form.
 * @returns Nothing; throws when request fails.
 */
export const updateDomainTableItem = async (
  resource: string,
  id: string,
  body: Record<string, unknown>,
) => {
  const { page, baseUrl } = await getDashboardPage(resource);
  await callDomain(`${baseUrl}${page.apiPrefix}/${id}`, (value) => value, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
};

/**
 * Deletes a domain table row through the registered API prefix.
 *
 * @param resource - Dashboard path segment.
 * @param id - Row identifier.
 * @returns Nothing; throws when request fails.
 */
export const deleteDomainTableItem = async (resource: string, id: string) => {
  const { page, baseUrl } = await getDashboardPage(resource);
  await callDomain(`${baseUrl}${page.apiPrefix}/${id}`, (value) => value, {
    method: "DELETE",
  });
};
