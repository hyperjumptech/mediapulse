"use client";

import { useState } from "react";

/** Result returned by {@link useDetailBlockTabs}. */
export type UseDetailBlockTabsReturn = {
  /** Zero-based index of the active tab. */
  activeIndex: number;
  /** Select the tab at `index` as active. */
  setActiveIndex: (index: number) => void;
  /** Row-count selection for a tab, or `undefined` when the tab has none yet. */
  limitForTab: (tabIndex: number) => string | undefined;
  /** Record the row-count selection for a tab. */
  setLimitForTab: (tabIndex: number, value: string) => void;
};

/**
 * Tab-selection and per-tab row-count state for a `tabs` detail block. Encapsulates the `useState`
 * calls so the consuming component stays declarative — see the `react-custom-hooks` rule.
 *
 * @returns The active tab index with its setter and the per-tab row-count accessors.
 */
export const useDetailBlockTabs = (): UseDetailBlockTabsReturn => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [limitByTab, setLimitByTab] = useState<Record<number, string>>({});

  return {
    activeIndex,
    setActiveIndex,
    limitForTab: (tabIndex) => limitByTab[tabIndex],
    setLimitForTab: (tabIndex, value) =>
      setLimitByTab((prev) => ({ ...prev, [tabIndex]: value })),
  };
};
