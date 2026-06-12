import type { RegisterDomainIntegrationResponse } from "@hermes/domain-contract";

/**
 * Returns whether a domain integration registered operator diagnostics pages.
 *
 * @param capabilities - Capability list from domain integration registration.
 * @returns True when `operator-diagnostics` is present.
 */
export const integrationSupportsOperatorDiagnostics = (
  capabilities: RegisterDomainIntegrationResponse["capabilities"],
): boolean => capabilities.includes("operator-diagnostics");
