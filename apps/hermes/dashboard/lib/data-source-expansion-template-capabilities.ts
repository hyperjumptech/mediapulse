/**
 * Capability checks for Hermes data source expansion template UI (no DB imports).
 */

/**
 * @param capabilities - Domain integration capability strings from orchestration.
 * @returns Whether the integration should show the expansion templates table-v1 UI.
 */
export const integrationSupportsHermesDataSourceExpansionTemplates = (
  capabilities: readonly string[],
): boolean => capabilities.includes("expand-step-inputs");
