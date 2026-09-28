"use client";

import { createContext, useContext, type ReactNode } from "react";

import {
  useCommandPalette,
  type CommandPaletteState,
} from "@/hooks/use-command-palette";

const CommandPaletteContext = createContext<CommandPaletteState | null>(null);

export const CommandPaletteProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const state = useCommandPalette();

  return (
    <CommandPaletteContext value={state}>{children}</CommandPaletteContext>
  );
};

export const useCommandPaletteContext = (): CommandPaletteState => {
  const state = useContext(CommandPaletteContext);
  if (!state) {
    throw new Error(
      "useCommandPaletteContext must be used inside a CommandPaletteProvider",
    );
  }

  return state;
};
