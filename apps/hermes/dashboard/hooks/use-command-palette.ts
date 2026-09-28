import { useCallback, useEffect, useState } from "react";

import {
  DASHBOARD_SEARCH_MINIMUM_QUERY_LENGTH,
  type DashboardSearchResponse,
  type DashboardSearchResult,
} from "@/lib/dashboard-search-contract";

export const COMMAND_PALETTE_INPUT_ATTRIBUTE = "data-command-palette-input";

export const COMMAND_PALETTE_SEARCH_DEBOUNCE_MILLISECONDS = 150;

const EDITABLE_ELEMENT_SELECTOR =
  "input, textarea, select, [contenteditable]:not([contenteditable='false'])";

const EMPTY_SEARCH_RESULTS: DashboardSearchResult[] = [];

type CompletedSearch = {
  query: string;
  results: DashboardSearchResult[];
};

export type CommandPaletteState = {
  open: boolean;
  setOpen: (nextOpen: boolean) => void;
  query: string;
  setQuery: (nextQuery: string) => void;
  results: DashboardSearchResult[];
  isSearching: boolean;
};

const isCommandPaletteShortcut = (event: KeyboardEvent): boolean => {
  const isModifierPressed = event.metaKey || event.ctrlKey;
  const isKPressed = event.key === "k" || event.key === "K";

  return isModifierPressed && isKPressed;
};

const isEditableTargetOutsidePalette = (
  target: EventTarget | null,
): boolean => {
  if (!(target instanceof Element)) {
    return false;
  }
  const paletteInput = target.closest(`[${COMMAND_PALETTE_INPUT_ATTRIBUTE}]`);
  if (paletteInput) {
    return false;
  }

  return target.closest(EDITABLE_ELEMENT_SELECTOR) !== null;
};

export const fetchDashboardSearchResults = async (
  query: string,
  signal: AbortSignal,
): Promise<DashboardSearchResult[]> => {
  const searchParams = new URLSearchParams({ q: query });
  const response = await fetch(
    `/api/dashboard-search?${searchParams.toString()}`,
    { signal },
  );
  if (!response.ok) {
    throw new Error(`Dashboard search failed with status ${response.status}`);
  }
  const responseBody = (await response.json()) as DashboardSearchResponse;

  return responseBody.results;
};

export const useCommandPalette = (): CommandPaletteState => {
  const [open, setOpenState] = useState(false);
  const [query, setQuery] = useState("");
  const [completedSearch, setCompletedSearch] =
    useState<CompletedSearch | null>(null);

  const setOpen = useCallback((nextOpen: boolean) => {
    setOpenState(nextOpen);
    if (!nextOpen) {
      setQuery("");
      setCompletedSearch(null);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isCommandPaletteShortcut(event)) {
        return;
      }
      if (isEditableTargetOutsidePalette(event.target)) {
        return;
      }
      event.preventDefault();
      setOpen(!open);
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, setOpen]);

  const trimmedQuery = query.trim();
  const isQuerySearchable =
    open && trimmedQuery.length >= DASHBOARD_SEARCH_MINIMUM_QUERY_LENGTH;

  useEffect(() => {
    if (!isQuerySearchable) {
      return;
    }
    const abortController = new AbortController();
    const runSearch = async () => {
      try {
        const searchResults = await fetchDashboardSearchResults(
          trimmedQuery,
          abortController.signal,
        );
        if (!abortController.signal.aborted) {
          setCompletedSearch({ query: trimmedQuery, results: searchResults });
        }
      } catch {
        if (!abortController.signal.aborted) {
          setCompletedSearch({ query: trimmedQuery, results: [] });
        }
      }
    };
    const debounceTimeoutId = window.setTimeout(() => {
      void runSearch();
    }, COMMAND_PALETTE_SEARCH_DEBOUNCE_MILLISECONDS);

    return () => {
      window.clearTimeout(debounceTimeoutId);
      abortController.abort();
    };
  }, [isQuerySearchable, trimmedQuery]);

  const results = isQuerySearchable
    ? (completedSearch?.results ?? EMPTY_SEARCH_RESULTS)
    : EMPTY_SEARCH_RESULTS;
  const isSearching =
    isQuerySearchable && completedSearch?.query !== trimmedQuery;

  return { open, setOpen, query, setQuery, results, isSearching };
};
