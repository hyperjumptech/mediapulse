"use client";

import { useEffect, useRef } from "react";

type UseCloseOnSuccessfulSubmitParams<TState> = {
  open: boolean;
  pending: boolean;
  state: TState;
  isSuccess: (state: TState) => boolean;
  onSuccess: () => void;
};

/**
 * Runs `onSuccess` after a submit cycle completes successfully.
 * A submit cycle is tracked as pending=true -> pending=false while the modal is open.
 */
export const useCloseOnSuccessfulSubmit = <TState>({
  open,
  pending,
  state,
  isSuccess,
  onSuccess,
}: UseCloseOnSuccessfulSubmitParams<TState>) => {
  const wasPendingRef = useRef(false);

  useEffect(() => {
    const succeeded = isSuccess(state);
    if (open && wasPendingRef.current && !pending && succeeded) {
      onSuccess();
    }
    wasPendingRef.current = pending;
  }, [open, pending, state, isSuccess, onSuccess]);
};
