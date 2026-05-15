import {
  requireDashboardPrincipalForRoute,
  resolveDashboardPrincipal,
} from "@/lib/auth-dashboard";
import { DashboardReadOnlyApiKeyError } from "@/lib/dashboard-read-only-api-key-error";

/**
 * Requires a full-access dashboard principal for Phase B mutation routes.
 *
 * @param request - Incoming HTTP request (Bearer or cookies).
 * @returns Dashboard user for the authenticated principal.
 */
export const requireMutationDashboardPrincipalForRoute = async (
  request?: Request,
): Promise<Awaited<ReturnType<typeof requireDashboardPrincipalForRoute>>> => {
  if (!request) {
    return requireDashboardPrincipalForRoute();
  }

  const principal = await resolveDashboardPrincipal(request);
  if (!principal) {
    throw new Error("Unauthorized");
  }

  if (principal.authMethod === "api_key" && principal.readOnly) {
    throw new DashboardReadOnlyApiKeyError();
  }

  return principal.user;
};
