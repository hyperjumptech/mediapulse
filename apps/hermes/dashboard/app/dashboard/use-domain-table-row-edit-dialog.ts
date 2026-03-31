import { useState } from "react";

/**
 * Manages visibility of the edit dialog for a domain table row.
 *
 * @returns `editOpen` flag and `setEditOpen` setter for the dialog.
 */
export const useDomainTableRowEditDialog = () => {
  const [editOpen, setEditOpen] = useState(false);
  return { editOpen, setEditOpen };
};
