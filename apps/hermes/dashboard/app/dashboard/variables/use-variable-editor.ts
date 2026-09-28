import { useCallback, useState } from "react";

import type { VariableRow } from "@/lib/variables";

export const useVariableEditor = () => {
  const [editingVariable, setEditingVariable] = useState<VariableRow | null>(
    null,
  );

  const handleEditorOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setEditingVariable(null);
    }
  }, []);

  return {
    editingVariable,
    openEditor: setEditingVariable,
    handleEditorOpenChange,
  };
};
