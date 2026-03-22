import * as React from "react";

export type PickerModalTab = "variables" | "expansions";

export type VariableExpansionPickerModalShell = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeTab: PickerModalTab;
  setActiveTab: React.Dispatch<React.SetStateAction<PickerModalTab>>;
};

/**
 * Controls dialog open state and active tab for the variable/expansion picker modal.
 *
 * @returns Open flag, tab id, and setters.
 */
export const useVariableExpansionPickerModalShell =
  (): VariableExpansionPickerModalShell => {
    const [open, setOpen] = React.useState(false);
    const [activeTab, setActiveTab] =
      React.useState<PickerModalTab>("variables");

    return { open, setOpen, activeTab, setActiveTab };
  };
