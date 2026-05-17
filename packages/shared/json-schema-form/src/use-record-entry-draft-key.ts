import { useCallback, useState } from "react";

import { SCHEMA_FORM_NEW_ENTRY_KEY } from "./schema-form-constants";

/**
 * Draft key state for a new record entry row. Commits on blur when non-empty.
 *
 * @param onKeyChange - Called with the trimmed key when the user blurs a non-empty draft.
 * @returns Draft key value, setter, and blur handler.
 */
export const useRecordEntryDraftKey = (
  onKeyChange: (newKey: string) => void,
) => {
  const [draftKey, setDraftKey] = useState("");
  const handleBlur = useCallback(() => {
    const k = draftKey.trim();
    if (k !== "" && k !== SCHEMA_FORM_NEW_ENTRY_KEY) onKeyChange(k);
  }, [draftKey, onKeyChange]);
  return { draftKey, setDraftKey, handleBlur };
};
