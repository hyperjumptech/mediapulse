"use server";

import { z } from "zod";

import { getDataSourceExpansionTemplateByIdForIntegration } from "@/lib/data-source-expansion-templates";
import { getDefaultDomainIntegration } from "@/lib/domain-integrations";
import { getDataSourceExpansionsPage } from "@/lib/data-source-expansions";
import { getDashboardSession } from "@/lib/auth-dashboard";
import { getVariablesPage } from "@/lib/variables";
import { prisma as orchestrationPrisma } from "@hermes/orchestration-database";

const pickerPageInputSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(5).max(100),
  search: z.string().optional(),
});
/** Single id (uses default domain integration) or explicit integration scope. */
const loadExpansionNameByIdInputSchema = z.union([
  z.object({
    integrationKey: z.string().min(1),
    id: z.string().trim().min(1),
  }),
  z.string().trim().min(1),
]);

export type LoadVariablePickerPageResult = {
  items: Array<{ key: string; description: string | null }>;
  total: number;
};

export type LoadExpansionPickerPageResult = {
  items: Array<{
    id: string;
    name: string;
    expansionString: string;
    description: string | null;
  }>;
  total: number;
};

type VariablePickerDependencies = {
  getSession?: typeof getDashboardSession;
  getVariables?: typeof getVariablesPage;
  db?: typeof orchestrationPrisma;
};

type ExpansionPickerDependencies = {
  getSession?: typeof getDashboardSession;
  getExpansionsPage?: typeof getDataSourceExpansionsPage;
  /** Loads template by id from orchestration DB (same ids as `{{dse:<id>}}`). */
  getExpansionTemplateById?: typeof getDataSourceExpansionTemplateByIdForIntegration;
  getIntegration?: typeof getDefaultDomainIntegration;
};

/**
 * Loads a page of variable keys for the step/config insert picker (authenticated).
 *
 * @param raw - Page, page size, optional search (validated with zod).
 * @param dependencies - Injectable session, DB, and getVariablesPage for tests.
 * @returns Variable keys and total count; empty when unauthorized.
 */
export const loadVariablePickerPage = async (
  raw: unknown,
  dependencies: VariablePickerDependencies = {},
): Promise<LoadVariablePickerPageResult> => {
  const getSession = dependencies.getSession ?? getDashboardSession;
  const getVariables = dependencies.getVariables ?? getVariablesPage;
  const db = dependencies.db ?? orchestrationPrisma;

  const session = await getSession();
  if (!session) {
    return { items: [], total: 0 };
  }

  const parsed = pickerPageInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { items: [], total: 0 };
  }

  const { page, pageSize, search } = parsed.data;
  const result = await getVariables(
    page,
    pageSize,
    { search: search?.trim() || undefined },
    db,
  );

  return {
    items: result.variables.map((v) => ({
      key: v.key,
      description:
        v.note != null && String(v.note).trim() !== ""
          ? String(v.note).trim()
          : null,
    })),
    total: result.total,
  };
};

/**
 * Loads a page of data source expansions for the insert picker (authenticated).
 *
 * @param raw - Page, page size, optional search (validated with zod).
 * @param dependencies - Injectable session, domain integration, and getDataSourceExpansionsPage for tests.
 * @returns Expansion rows and total count; empty when unauthorized or domain unavailable.
 */
export const loadExpansionPickerPage = async (
  raw: unknown,
  dependencies: ExpansionPickerDependencies = {},
): Promise<LoadExpansionPickerPageResult> => {
  const getSession = dependencies.getSession ?? getDashboardSession;
  const getExpansionsPage =
    dependencies.getExpansionsPage ?? getDataSourceExpansionsPage;
  const getIntegration =
    dependencies.getIntegration ?? getDefaultDomainIntegration;

  const session = await getSession();
  if (!session) {
    return { items: [], total: 0 };
  }

  const parsed = pickerPageInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { items: [], total: 0 };
  }

  const { page, pageSize, search } = parsed.data;

  try {
    const integration = await getIntegration();
    const result = await getExpansionsPage(integration.key, page, pageSize, {
      search: search?.trim() || undefined,
    });

    return {
      items: result.expansions.map((e) => ({
        id: e.id,
        name: e.name,
        expansionString: e.expansionString,
        description:
          e.description != null && String(e.description).trim() !== ""
            ? String(e.description).trim()
            : null,
      })),
      total: result.total,
    };
  } catch {
    return { items: [], total: 0 };
  }
};

/**
 * Resolves a data source expansion template id to its display name for persisted `{{dse:<id>}}` values.
 *
 * @param raw - Template id string (default integration) or `{ integrationKey, id }` for the pipeline’s integration.
 * @param dependencies - Injectable session, integration resolver, and template loader for tests.
 * @returns Template name when found; otherwise null.
 */
export const loadExpansionNameById = async (
  raw: unknown,
  dependencies: ExpansionPickerDependencies = {},
): Promise<string | null> => {
  const getSession = dependencies.getSession ?? getDashboardSession;
  const getIntegration =
    dependencies.getIntegration ?? getDefaultDomainIntegration;
  const getExpansionTemplateById =
    dependencies.getExpansionTemplateById ??
    getDataSourceExpansionTemplateByIdForIntegration;

  const session = await getSession();
  if (!session) {
    return null;
  }

  const parsed = loadExpansionNameByIdInputSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }

  let integrationKey: string;
  let id: string;
  if (typeof parsed.data === "string") {
    try {
      const integration = await getIntegration();
      integrationKey = integration.key;
    } catch {
      return null;
    }
    id = parsed.data;
  } else {
    integrationKey = parsed.data.integrationKey;
    id = parsed.data.id;
  }

  try {
    const row = await getExpansionTemplateById(integrationKey, id);
    if (row == null) {
      return null;
    }
    const name = row["name"];
    if (typeof name !== "string" || name.trim() === "") {
      return null;
    }
    return name.trim();
  } catch {
    return null;
  }
};
