import { useEffect, useState } from "react";

type ActionState = { status?: boolean } | null | undefined;

export const useConfirmActionDialog = (actionState: ActionState) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (actionState?.status === true) {
      setOpen(false);
    }
  }, [actionState]);

  const requestConfirmation = () => setOpen(true);

  return { open, setOpen, requestConfirmation };
};
