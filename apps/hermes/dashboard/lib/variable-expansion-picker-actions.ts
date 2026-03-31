"use server";

import { z } from "zod";

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
    const result = await getExpansionsPage(
      integration.integrationId,
      page,
      pageSize,
      {
        search: search?.trim() || undefined,
      },
    );

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
