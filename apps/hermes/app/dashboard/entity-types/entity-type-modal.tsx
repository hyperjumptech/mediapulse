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
import type { EntityTypesPageResult } from "@/lib/entity-types";
import { useFormAction as useCreateFormAction } from "@/app/dashboard/entity-types/actions/create/.generated/use-form-action";
import { useFormAction as useUpdateFormAction } from "@/app/dashboard/entity-types/actions/update/.generated/use-form-action";

import { EntityTypeFormFields } from "./entity-type-form-fields";

type EntityTypeRow = EntityTypesPageResult["entityTypes"][number];

/** Create mode: optional trigger to open; uncontrolled open state. */
type EntityTypeModalCreateProps = {
  entityType: null;
  trigger?: ReactNode;
  open?: never;
  onOpenChange?: never;
};

/** Edit mode: row when selected; controlled open state. */
type EntityTypeModalEditProps = {
  entityType: EntityTypeRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: never;
};

export type EntityTypeModalProps =
  | EntityTypeModalCreateProps
  | EntityTypeModalEditProps;

/**
 * Returns whether props select create (add) flow vs edit flow.
 */
const isCreateMode = (
  props: EntityTypeModalProps,
): props is EntityTypeModalCreateProps =>
  props.entityType === null && !("open" in props);

/**
 * Encapsulates create/edit entity type modal state, dual form actions, and success handling.
 */
const useEntityTypeModalState = (props: EntityTypeModalProps) => {
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

  const row = !isCreate ? props.entityType : null;
  const title = isCreate
    ? "Add entity type"
    : row
      ? `Edit entity type: ${row.name}`
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
 * Modal to create or edit an entity type.
 * Create: pass `entityType={null}` and a `trigger` node.
 * Edit: pass the row, `open`, and `onOpenChange` (see variables `VariableModal`).
 */
export const EntityTypeModal = (props: EntityTypeModalProps) => {
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
  } = useEntityTypeModalState(props);

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
            <EntityTypeFormFields
              mode="create"
              pending={pending}
              errorMessage={errorMessage}
              submitLabel={pending ? "Creating..." : "Create entity type"}
            />
          ) : row ? (
            <EntityTypeFormFields
              mode="edit"
              entityTypeId={row.id}
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
