"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { useFormAction as useCreateFormAction } from "@/app/dashboard/variables/actions/create/.generated/use-form-action";
import { useFormAction as useUpdateFormAction } from "@/app/dashboard/variables/actions/update/.generated/use-form-action";

import { VariableFormFields } from "./variable-form-fields";
import type { VariablesPageResult } from "@/lib/variables";

type VariableRow = VariablesPageResult["variables"][number];

/** Create mode: variable is null, trigger to open. */
type VariableModalCreateProps = {
  variable: null;
  trigger?: React.ReactNode;
  open?: never;
  onOpenChange?: never;
};

/** Edit mode: variable when selected, controlled open state. */
type VariableModalEditProps = {
  variable: VariableRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: never;
};

export type VariableModalProps =
  | VariableModalCreateProps
  | VariableModalEditProps;

const isCreateMode = (
  props: VariableModalProps,
): props is VariableModalCreateProps =>
  props.variable === null && !("open" in props);

/**
 * Single modal for creating or editing a variable. Use composition:
 * - Create: <VariableModal variable={null} trigger={<Button>Add variable</Button>} />
 * - Edit: <VariableModal variable={row} open={...} onOpenChange={...} />
 */
export const VariableModal = (props: VariableModalProps) => {
  const router = useRouter();
  const isCreate = isCreateMode(props);

  const [internalOpen, setInternalOpen] = useState(false);
  const open = isCreate ? internalOpen : props.open;
  const setOpenRef = useRef<(open: boolean) => void>(() => {});
  if (isCreate) {
    setOpenRef.current = setInternalOpen;
  } else {
    setOpenRef.current = props.onOpenChange;
  }

  const onOpenChangeRef = useRef<(open: boolean) => void>(() => {});
  if (!isCreate) {
    onOpenChangeRef.current = props.onOpenChange;
  }

  const createAction = useCreateFormAction();
  const updateAction = useUpdateFormAction();

  const action = isCreate ? createAction : updateAction;
  const { FormWithAction, state, pending } = action;

  const errorMessage = useMemo(
    () => (state && state.status === false ? (state.message as string) : null),
    [state],
  );

  const createSuccessId = useMemo(
    () =>
      state && state.status === true && state.data && "id" in state.data
        ? String((state.data as { id: string }).id)
        : null,
    [state],
  );
  const updateSuccess = useMemo(
    () => (isCreate ? false : Boolean(state && state.status === true)),
    [isCreate, state],
  );

  const handledCreateIdRef = useRef<string | null>(null);
  const didHandleUpdateRef = useRef(false);

  useEffect(() => {
    if (open) {
      handledCreateIdRef.current = null;
      didHandleUpdateRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (
      isCreate &&
      createSuccessId != null &&
      handledCreateIdRef.current !== createSuccessId
    ) {
      handledCreateIdRef.current = createSuccessId;
      setOpenRef.current(false);
      const id = setTimeout(() => router.refresh(), 0);
      return () => clearTimeout(id);
    }
  }, [isCreate, createSuccessId, router]);

  useEffect(() => {
    if (!isCreate && updateSuccess && !didHandleUpdateRef.current) {
      didHandleUpdateRef.current = true;
      onOpenChangeRef.current(false);
      const id = setTimeout(() => router.refresh(), 0);
      return () => clearTimeout(id);
    }
  }, [isCreate, updateSuccess, router]);

  const variable = !isCreate ? props.variable : null;
  const title = isCreate
    ? "Add variable"
    : variable
      ? `Edit variable: ${variable.key}`
      : "";
  const trigger =
    isCreate && "trigger" in props && props.trigger != null
      ? props.trigger
      : null;

  const dialogContent = (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <FormWithAction className="flex flex-col gap-4">
        {isCreate ? (
          <VariableFormFields
            mode="create"
            pending={pending}
            errorMessage={errorMessage}
            submitLabel={pending ? "Creating…" : "Create variable"}
          />
        ) : variable ? (
          <VariableFormFields
            mode="edit"
            id={variable.id}
            initialKey={variable.key}
            initialValue={variable.value}
            initialNote={variable.note}
            initialIsSecret={variable.isSecret}
            pending={pending}
            errorMessage={errorMessage}
            submitLabel={pending ? "Saving…" : "Save changes"}
          />
        ) : null}
      </FormWithAction>
    </DialogContent>
  );

  if (trigger != null) {
    return (
      <Dialog open={open} onOpenChange={setOpenRef.current}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        {dialogContent}
      </Dialog>
    );
  }

  if (isCreate) return null;

  if (!("open" in props) || variable == null) return null;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {dialogContent}
    </Dialog>
  );
};
