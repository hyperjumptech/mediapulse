import * as React from "react";

import { useDebouncedValue } from "./use-debounced-value";

export type TabSearchState = {
  searchInput: string;
  setSearchInput: React.Dispatch<React.SetStateAction<string>>;
  debouncedSearch: string;
};

const DEBOUNCE_MS = 300;

/**
 * Local search input with debounced value for API calls.
 *
 * @returns Controlled search string, setter, and debounced search for loaders.
 */
export const useTabSearchState = (): TabSearchState => {
  const [searchInput, setSearchInput] = React.useState("");
  const debouncedSearch = useDebouncedValue(searchInput, DEBOUNCE_MS);

  return { searchInput, setSearchInput, debouncedSearch };
};
