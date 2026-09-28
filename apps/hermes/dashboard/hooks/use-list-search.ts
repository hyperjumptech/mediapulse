import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import {
  buildSearchHref,
  type ListUrlState,
} from "@/lib/data-table/list-url-state";

export const LIST_SEARCH_DEBOUNCE_MS = 300;

export const useListSearch = (urlState: ListUrlState) => {
  const router = useRouter();
  const activeSearch = urlState.search ?? "";
  const [value, setValue] = useState(activeSearch);
  const [lastSeenSearch, setLastSeenSearch] = useState(activeSearch);
  const [requestedSearch, setRequestedSearch] = useState(activeSearch);
  const [isPending, startTransition] = useTransition();

  if (lastSeenSearch !== activeSearch) {
    setLastSeenSearch(activeSearch);
    if (activeSearch !== requestedSearch) {
      setRequestedSearch(activeSearch);
      setValue(activeSearch);
    }
  }

  const navigateTo = useCallback(
    (search: string) => {
      setRequestedSearch(search);
      startTransition(() => {
        router.replace(buildSearchHref(urlState, search), { scroll: false });
      });
    },
    [router, urlState],
  );

  const nextSearch = value.trim();

  useEffect(() => {
    if (nextSearch === requestedSearch) {
      return;
    }
    const timeout = window.setTimeout(
      () => navigateTo(nextSearch),
      LIST_SEARCH_DEBOUNCE_MS,
    );

    return () => window.clearTimeout(timeout);
  }, [nextSearch, requestedSearch, navigateTo]);

  const submit = useCallback(() => {
    if (nextSearch !== requestedSearch) {
      navigateTo(nextSearch);
    }
  }, [navigateTo, nextSearch, requestedSearch]);

  const reset = useCallback(() => {
    setValue("");
    navigateTo("");
  }, [navigateTo]);

  return { value, setValue, submit, reset, isPending };
};
