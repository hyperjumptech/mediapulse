import { useCallback, useRef, useState } from "react";

import {
  isOverviewActivityView,
  type OverviewActivityView,
} from "./overview-activity-views";

type ViewSwitcherControl = "tab" | "select";

const VIEW_SWITCHER_CONTROL_SELECTOR: Record<ViewSwitcherControl, string> = {
  tab: '[role="tab"][data-state="active"]',
  select: '[role="combobox"]',
};

const focusedViewSwitcherControl = (): ViewSwitcherControl | null => {
  const focusedRole = document.activeElement?.getAttribute("role");
  if (focusedRole === "tab") {
    return "tab";
  }
  if (focusedRole === "option" || focusedRole === "combobox") {
    return "select";
  }

  return null;
};

export const useOverviewActivityView = () => {
  const [view, setView] = useState<OverviewActivityView>("running");
  const controlToRefocusRef = useRef<ViewSwitcherControl | null>(null);

  const changeView = useCallback((nextView: string) => {
    if (!isOverviewActivityView(nextView)) {
      return;
    }
    controlToRefocusRef.current = focusedViewSwitcherControl();
    setView(nextView);
  }, []);

  const viewSwitcherRef = useCallback((viewSwitcher: HTMLElement | null) => {
    const controlToRefocus = controlToRefocusRef.current;
    if (!viewSwitcher || !controlToRefocus) {
      return;
    }
    controlToRefocusRef.current = null;
    const selector = VIEW_SWITCHER_CONTROL_SELECTOR[controlToRefocus];
    viewSwitcher.querySelector<HTMLElement>(selector)?.focus();
  }, []);

  return { view, changeView, viewSwitcherRef };
};
