"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { PreviewExpansionResponse } from "@hermes/domain-contract";

import {
  createDomainTableItem,
  previewDomainExpansion,
  updateDomainTableItem,
} from "@/lib/domain-dashboard";

/**
 * Creates a table row and returns to the list page.
 *
 * @param integrationKey - Registered domain integration key.
 * @param resource - Manifest path segment.
 * @param basePath - List path to revalidate and redirect to.
 * @param payload - Parsed create body.
 */
export const submitDomainTableFullPageCreate = async (
  integrationKey: string,
  resource: string,
  basePath: string,
  payload: Record<string, unknown>,
): Promise<void> => {
  await createDomainTableItem(integrationKey, resource, payload);
  revalidatePath(basePath);
  redirect(basePath);
};

/**
 * Updates a table row and returns to the list page.
 *
 * @param integrationKey - Registered domain integration key.
 * @param resource - Manifest path segment.
 * @param id - Row id.
 * @param basePath - List path to revalidate and redirect to.
 * @param payload - Parsed update body.
 */
export const submitDomainTableFullPageUpdate = async (
  integrationKey: string,
  resource: string,
  id: string,
  basePath: string,
  payload: Record<string, unknown>,
): Promise<void> => {
  await updateDomainTableItem(integrationKey, resource, id, payload);
  revalidatePath(basePath);
  redirect(basePath);
};

/**
 * Server action wrapper for the preview panel (calls domain `preview-expansion`).
 *
 * @param integrationKey - Registered domain integration key.
 * @param expansionString - Expansion string to resolve.
 * @returns Parsed preview response.
 */
export const runDomainTablePreviewExpansion = async (
  integrationKey: string,
  expansionString: string,
): Promise<PreviewExpansionResponse> => {
  return previewDomainExpansion(integrationKey, expansionString);
};
