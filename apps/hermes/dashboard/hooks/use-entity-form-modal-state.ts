import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CREATE_QUERY_PARAM } from "@/lib/dashboard-routes";

export type EntityFormModalMode = "create" | "edit";

export type EntityFormModalController = {
  open: boolean;
  mode: EntityFormModalMode;
  editId: string | null;
  setOpen: (open: boolean) => void;
  openCreate: () => void;
  openEdit: (entityId: string) => void;
};

const useCreateRequestedFromUrl = () => {
  const searchParams = useSearchParams();
  const createRequested = searchParams?.get(CREATE_QUERY_PARAM) === "1";

  const clearCreateRequest = useCallback(() => {
    if (!createRequested) {
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete(CREATE_QUERY_PARAM);
    window.history.replaceState(window.history.state, "", url);
  }, [createRequested]);

  return { createRequested, clearCreateRequest };
};

export const useEntityFormModalState = (): EntityFormModalController => {
  const { createRequested, clearCreateRequest } = useCreateRequestedFromUrl();
  const [open, setOpenState] = useState(createRequested);
  const [mode, setMode] = useState<EntityFormModalMode>("create");
  const [editId, setEditId] = useState<string | null>(null);

  const openCreate = useCallback(() => {
    setMode("create");
    setEditId(null);
    setOpenState(true);
  }, []);

  useEffect(() => {
    if (createRequested) {
      openCreate();
    }
  }, [createRequested, openCreate]);

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      setOpenState(nextOpen);
      if (!nextOpen) {
        clearCreateRequest();
      }
    },
    [clearCreateRequest],
  );

  const openEdit = useCallback((entityId: string) => {
    setMode("edit");
    setEditId(entityId);
    setOpenState(true);
  }, []);

  return useMemo(
    () => ({ open, mode, editId, setOpen, openCreate, openEdit }),
    [open, mode, editId, setOpen, openCreate, openEdit],
  );
};
