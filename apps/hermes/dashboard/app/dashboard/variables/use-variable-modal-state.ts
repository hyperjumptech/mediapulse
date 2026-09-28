"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useFormAction as useCreateFormAction } from "@/app/dashboard/variables/actions/create/.generated/use-form-action";
import { getVariablePipelineUsage } from "@/app/dashboard/variables/actions/get-usage";
import { useFormAction as useUpdateFormAction } from "@/app/dashboard/variables/actions/update/.generated/use-form-action";
import { useCreateRequestOpenState } from "@/hooks/use-create-request";
import type { PipelineUsageSummary } from "@/lib/pipeline-usage";
import type { VariablesPageResult } from "@/lib/variables";

type VariableRow = VariablesPageResult["variables"][number];

type VariableModalCreateProps = {
  variable: null;
  open?: never;
  onOpenChange?: never;
};

type VariableModalEditProps = {
  variable: VariableRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export type VariableModalProps =
  | VariableModalCreateProps
  | VariableModalEditProps;

export type VariableModalTab = "form" | "usage";

type VariableUsageState =
  | {
      status: "idle" | "loading";
      variableKey: string | null;
      usages: PipelineUsageSummary[];
      errorMessage: null;
    }
  | {
      status: "loaded";
      variableKey: string;
      usages: PipelineUsageSummary[];
      errorMessage: null;
    }
  | {
      status: "error";
      variableKey: string;
      usages: PipelineUsageSummary[];
      errorMessage: string;
    };

const isCreateMode = (
  props: VariableModalProps,
): props is VariableModalCreateProps =>
  props.variable === null && !("open" in props);

const initialUsageState = (): VariableUsageState => ({
  status: "idle",
  variableKey: null,
  usages: [],
  errorMessage: null,
});

export const useVariableModalState = (props: VariableModalProps) => {
  const isCreate = isCreateMode(props);

  const createRequest = useCreateRequestOpenState();
  const open = isCreate ? createRequest.open : props.open;
  const setOpenRef = useRef<(open: boolean) => void>(() => {});
  if (isCreate) {
    setOpenRef.current = createRequest.setOpen;
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
    }
  }, [isCreate, createSuccessId]);

  useEffect(() => {
    if (!isCreate && updateSuccess && !didHandleUpdateRef.current) {
      didHandleUpdateRef.current = true;
      onOpenChangeRef.current(false);
    }
  }, [isCreate, updateSuccess]);

  const variable = !isCreate ? props.variable : null;
  const title = isCreate
    ? "Add variable"
    : variable
      ? `Edit variable: ${variable.key}`
      : "";

  return {
    open,
    setOpenRef,
    FormWithAction,
    pending,
    errorMessage,
    isCreate,
    variable,
    title,
  };
};

export const useVariableUsageState = ({
  open,
  isCreate,
  variable,
}: {
  open: boolean;
  isCreate: boolean;
  variable: VariableRow | null;
}) => {
  const [activeTab, setActiveTab] = useState<VariableModalTab>("form");
  const [usageState, setUsageState] =
    useState<VariableUsageState>(initialUsageState());

  const loadUsage = useCallback(async (variableKey: string) => {
    setUsageState({
      status: "loading",
      variableKey,
      usages: [],
      errorMessage: null,
    });
    try {
      const usages = await getVariablePipelineUsage(variableKey);
      setUsageState({
        status: "loaded",
        variableKey,
        usages,
        errorMessage: null,
      });
    } catch {
      setUsageState({
        status: "error",
        variableKey,
        usages: [],
        errorMessage: "Failed to load pipeline usage. Try again.",
      });
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setActiveTab("form");
      setUsageState(initialUsageState());
      return;
    }
    if (isCreate || variable == null) {
      setUsageState(initialUsageState());
    }
  }, [open, isCreate, variable]);

  useEffect(() => {
    if (!open || isCreate || variable == null || activeTab !== "usage") {
      return;
    }
    const isAlreadyRequestedForKey =
      usageState.variableKey === variable.key && usageState.status !== "idle";
    if (isAlreadyRequestedForKey) {
      return;
    }
    void loadUsage(variable.key);
  }, [activeTab, isCreate, loadUsage, open, usageState, variable]);

  const retry = useCallback(() => {
    if (variable == null) {
      return;
    }
    void loadUsage(variable.key);
  }, [loadUsage, variable]);

  return {
    activeTab,
    setActiveTab,
    usageState,
    retry,
  };
};
