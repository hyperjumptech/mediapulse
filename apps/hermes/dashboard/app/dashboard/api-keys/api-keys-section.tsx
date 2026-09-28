import { mergeColumnVisibility } from "@/lib/data-table/column-visibility";
import { readColumnVisibility } from "@/lib/data-table/read-column-visibility";
import { listActiveMcpApiKeys } from "@/lib/mcp-api-keys";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

import { ApiKeysTable } from "./api-keys-table";
import {
  API_KEYS_DEFAULT_COLUMN_VISIBILITY,
  API_KEYS_TABLE_ID,
} from "./api-keys-table-defaults";

export const ApiKeysSection = async () => {
  const [apiKeys, savedVisibility] = await Promise.all([
    withDashboardAdmin(listActiveMcpApiKeys()),
    readColumnVisibility(API_KEYS_TABLE_ID),
  ]);

  return (
    <ApiKeysTable
      apiKeys={apiKeys}
      initialColumnVisibility={mergeColumnVisibility(
        API_KEYS_DEFAULT_COLUMN_VISIBILITY,
        savedVisibility,
      )}
    />
  );
};
