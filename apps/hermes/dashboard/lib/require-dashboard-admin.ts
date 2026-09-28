import { redirect } from "next/navigation";
import { cache } from "react";

import {
  getDashboardSession,
  HERMES_DASHBOARD_CLEAR_SESSION_PATH,
  resolveHermesActiveAdminDashboardAccess,
  type DashboardUser,
} from "@/lib/auth-dashboard";

export const getDashboardAdmin = cache(
  async (): Promise<DashboardUser | null> => {
    const session = await getDashboardSession();
    if (!session) {
      return null;
    }
    const access = await resolveHermesActiveAdminDashboardAccess({
      getSession: async () => session,
    });

    return access.ok ? session : null;
  },
);

export const requireDashboardAdmin = async (): Promise<DashboardUser> => {
  const admin = await getDashboardAdmin();
  if (!admin) {
    redirect(HERMES_DASHBOARD_CLEAR_SESSION_PATH);
  }

  return admin;
};

export const withDashboardAdmin = async <Value>(
  load: Promise<Value>,
): Promise<Value> => {
  const [authResult, loadResult] = await Promise.allSettled([
    requireDashboardAdmin(),
    load,
  ]);
  if (authResult.status === "rejected") {
    throw authResult.reason;
  }
  if (loadResult.status === "rejected") {
    throw loadResult.reason;
  }

  return loadResult.value;
};
