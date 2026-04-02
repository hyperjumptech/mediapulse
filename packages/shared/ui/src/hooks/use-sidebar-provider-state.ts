import * as React from "react";

/** Expanded vs collapsed for sidebar layout and data attributes. */
export type SidebarState = "expanded" | "collapsed";

/** Value provided by `SidebarProvider` / consumed by `useSidebar`. */
export type SidebarContextValue = {
  state: SidebarState;
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleSidebar: () => void;
};

export type UseSidebarProviderStateParams = {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/** Controlled or uncontrolled open state for the sidebar shell. */
export function useSidebarProviderState({
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
}: UseSidebarProviderStateParams): SidebarContextValue {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const state: SidebarState = open ? "expanded" : "collapsed";

  const setOpen = React.useCallback(
    (value: boolean) => {
      if (!isControlled) setUncontrolledOpen(value);
      onOpenChange?.(value);
    },
    [isControlled, onOpenChange],
  );
  const toggleSidebar = React.useCallback(
    () => setOpen(!open),
    [open, setOpen],
  );

  return React.useMemo(
    () => ({ state, open, setOpen, toggleSidebar }),
    [state, open, setOpen, toggleSidebar],
  );
}
