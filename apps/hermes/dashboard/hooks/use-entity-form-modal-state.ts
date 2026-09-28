import { useCallback, useMemo, useState } from "react";

export type EntityFormModalMode = "create" | "edit";

export type EntityFormModalController = {
  open: boolean;
  mode: EntityFormModalMode;
  editId: string | null;
  setOpen: (open: boolean) => void;
  openCreate: () => void;
  openEdit: (entityId: string) => void;
};

export const useEntityFormModalState = (): EntityFormModalController => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<EntityFormModalMode>("create");
  const [editId, setEditId] = useState<string | null>(null);

  const openCreate = useCallback(() => {
    setMode("create");
    setEditId(null);
    setOpen(true);
  }, []);

  const openEdit = useCallback((entityId: string) => {
    setMode("edit");
    setEditId(entityId);
    setOpen(true);
  }, []);

  return useMemo(
    () => ({ open, mode, editId, setOpen, openCreate, openEdit }),
    [open, mode, editId, openCreate, openEdit],
  );
};
