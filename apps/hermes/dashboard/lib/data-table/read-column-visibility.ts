import { cookies } from "next/headers";

import {
  columnVisibilityCookieName,
  parseColumnVisibility,
  type ColumnVisibility,
} from "./column-visibility";

export const readColumnVisibility = async (
  tableId: string,
): Promise<ColumnVisibility> => {
  const cookieStore = await cookies();

  return parseColumnVisibility(
    cookieStore.get(columnVisibilityCookieName(tableId))?.value,
  );
};
