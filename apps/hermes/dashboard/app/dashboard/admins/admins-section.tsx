import { mergeColumnVisibility } from "@/lib/data-table/column-visibility";
import { readColumnVisibility } from "@/lib/data-table/read-column-visibility";
import { loadHermesAdminsForPage } from "@/lib/hermes-admins-page";
import { requireDashboardAdmin } from "@/lib/require-dashboard-admin";

import {
  ADMINS_DEFAULT_COLUMN_VISIBILITY,
  ADMINS_TABLE_ID,
} from "./admins-table-defaults";
import { AdminsTable } from "./admins-table";

export const AdminsSection = async () => {
  const [admins, currentUser, savedVisibility] = await Promise.all([
    loadHermesAdminsForPage(),
    requireDashboardAdmin(),
    readColumnVisibility(ADMINS_TABLE_ID),
  ]);

  return (
    <AdminsTable
      admins={admins}
      currentUserId={currentUser.id}
      initialColumnVisibility={mergeColumnVisibility(
        ADMINS_DEFAULT_COLUMN_VISIBILITY,
        savedVisibility,
      )}
    />
  );
};
