"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import type { RelationTypesPageResult } from "@/lib/relation-types";
import { useFormAction as useCreateFormAction } from "@/app/dashboard/relation-types/actions/create/.generated/use-form-action";
import { useFormAction as useUpdateFormAction } from "@/app/dashboard/relation-types/actions/update/.generated/use-form-action";

import { RelationTypeFormFields } from "./relation-type-form-fields";

type RelationTypeRow = RelationTypesPageResult["relationTypes"][number];

/** Create mode: optional trigger to open; uncontrolled open state. */
type RelationTypeModalCreateProps = {
  relationType: null;
  trigger?: ReactNode;
  open?: never;
  onOpenChange?: never;
};

/** Edit mode: row when selected; controlled open state. */
type RelationTypeModalEditProps = {
  relationType: RelationTypeRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: never;
};

export type RelationTypeModalProps =
  | RelationTypeModalCreateProps
  | RelationTypeModalEditProps;

/**
 * Returns whether props select create (add) flow vs edit flow.
 */
const isCreateMode = (
  props: RelationTypeModalProps,
): props is RelationTypeModalCreateProps =>
  props.relationType === null && !("open" in props);

/**
 * Encapsulates create/edit relation type modal state, dual form actions, and success handling.
 */
const useRelationTypeModalState = (props: RelationTypeModalProps) => {
  const router = useRouter();
  const isCreate = isCreateMode(props);

  const [internalOpen, setInternalOpen] = useState(false);
  const open = isCreate ? internalOpen : props.open;

  const setOpenRef = useRef<(value: boolean) => void>(() => {});
  if (isCreate) {
    setOpenRef.current = setInternalOpen;
  } else {
    setOpenRef.current = props.onOpenChange;
  }

  const onOpenChangeRef = useRef<(value: boolean) => void>(() => {});
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

  const row = !isCreate ? props.relationType : null;
  const title = isCreate
    ? "Add relation type"
    : row
      ? `Edit relation type: ${row.name}`
      : "";

  const trigger =
    isCreate && "trigger" in props && props.trigger != null
      ? props.trigger
      : null;

  return {
    open,
    setOpenRef,
    FormWithAction,
    pending,
    errorMessage,
    isCreate,
    row,
    title,
    trigger,
  };
};

/**
 * Modal to create or edit a relation type.
 * Create: pass `relationType={null}` and a `trigger` node.
 * Edit: pass the row, `open`, and `onOpenChange` (see `EntityTypeModal` / `VariableModal`).
 */
export const RelationTypeModal = (props: RelationTypeModalProps) => {
  const {
    open,
    setOpenRef,
    FormWithAction,
    pending,
    errorMessage,
    isCreate,
    row,
    title,
    trigger,
  } = useRelationTypeModalState(props);

  const dialogContent = (
    <DialogContent
      className="flex max-h-[85vh] w-[min(42rem,calc(100vw-2rem))] max-w-2xl flex-col overflow-hidden p-6"
      aria-describedby={undefined}
    >
      <DialogHeader className="shrink-0">
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <FormWithAction className="flex flex-col gap-4">
          {isCreate ? (
            <RelationTypeFormFields
              mode="create"
              pending={pending}
              errorMessage={errorMessage}
              submitLabel={pending ? "Creating..." : "Create relation type"}
            />
          ) : row ? (
            <RelationTypeFormFields
              mode="edit"
              relationTypeId={row.id}
              initialName={row.name}
              initialDescription={row.description}
              pending={pending}
              errorMessage={errorMessage}
              submitLabel={pending ? "Saving..." : "Save changes"}
            />
          ) : null}
        </FormWithAction>
      </div>
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

  if (!("open" in props) || row == null) return null;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {dialogContent}
    </Dialog>
  );
};
