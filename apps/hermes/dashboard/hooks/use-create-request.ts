import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CREATE_QUERY_PARAM } from "@/lib/dashboard-routes";

export const useCreateRequestedFromUrl = () => {
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

export const useCreateRequestOpenState = () => {
  const { createRequested, clearCreateRequest } = useCreateRequestedFromUrl();
  const [open, setOpenState] = useState(createRequested);

  useEffect(() => {
    if (createRequested) {
      setOpenState(true);
    }
  }, [createRequested]);

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      setOpenState(nextOpen);
      if (!nextOpen) {
        clearCreateRequest();
      }
    },
    [clearCreateRequest],
  );

  return { open, setOpen };
};
