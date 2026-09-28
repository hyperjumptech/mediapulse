"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Dialog, DialogTrigger } from "@workspace/ui/components/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import { Button } from "@workspace/ui/components/button";
import { useFormAction as useCreateFormAction } from "@/app/dashboard/variables/actions/create/.generated/use-form-action";
import { useFormAction as useUpdateFormAction } from "@/app/dashboard/variables/actions/update/.generated/use-form-action";
import { getVariablePipelineUsage } from "@/app/dashboard/variables/actions/get-usage";

import { VariableFormFields } from "./variable-form-fields";
import type { VariablesPageResult } from "@/lib/variables";
import { PipelineUsageList } from "@/components/pipeline-usage-list";
import {
  FormDialogBody,
  FormDialogCancelButton,
  FormDialogContent,
  FormDialogFooter,
  FormDialogHeader,
  formDialogFormClassName,
} from "@/components/form-dialog";
import { FormErrorAlert } from "@/components/form-error-alert";
import { SubmitButton } from "@/components/submit-button";
import type { PipelineUsageSummary } from "@/lib/pipeline-usage";

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

type VariableModalTab = "form" | "usage";

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

/**
 * Encapsulates create/edit variable modal state, form actions, and success effects.
 */
const useVariableModalState = (props: VariableModalProps) => {
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
    variable,
    title,
    trigger,
  };
};

/**
 * Lazily loads variable usage when the edit modal switches to the usage tab.
 */
const useVariableUsageState = ({
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
    const isAlreadyLoadedForKey =
      usageState.variableKey === variable.key &&
      (usageState.status === "loaded" || usageState.status === "loading");
    if (isAlreadyLoadedForKey) {
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

/**
 * Single modal for creating or editing a variable. Use composition:
 * - Create: <VariableModal variable={null} trigger={<Button>Add variable</Button>} />
 * - Edit: <VariableModal variable={row} open={...} onOpenChange={...} />
 */
export const VariableModal = (props: VariableModalProps) => {
  const {
    open,
    setOpenRef,
    FormWithAction,
    pending,
    errorMessage,
    isCreate,
    variable,
    title,
    trigger,
  } = useVariableModalState(props);
  const { activeTab, setActiveTab, usageState, retry } = useVariableUsageState({
    open,
    isCreate,
    variable,
  });

  const closeModal = () => setOpenRef.current(false);
  const cancelButton = (
    <FormDialogCancelButton onCancel={closeModal} disabled={pending} />
  );

  const dialogContent = (
    <FormDialogContent>
      <FormDialogHeader title={title} />
      {isCreate ? (
        <FormWithAction className={formDialogFormClassName}>
          <FormDialogBody>
            <VariableFormFields mode="create" pending={pending} />
          </FormDialogBody>
          <FormDialogFooter errorMessage={errorMessage}>
            {cancelButton}
            <SubmitButton pending={pending} pendingLabel="Creating…">
              Create variable
            </SubmitButton>
          </FormDialogFooter>
        </FormWithAction>
      ) : variable ? (
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as VariableModalTab)}
          className="min-h-0 flex-1 gap-0"
        >
          <div className="shrink-0 px-6 pt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="form">Form</TabsTrigger>
              <TabsTrigger value="usage">Used in pipelines</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="form" className="flex min-h-0 flex-col">
            <FormWithAction className={formDialogFormClassName}>
              <FormDialogBody>
                <VariableFormFields
                  mode="edit"
                  id={variable.id}
                  initialKey={variable.key}
                  initialValue={variable.value}
                  initialNote={variable.note}
                  initialIsSecret={variable.isSecret}
                  pending={pending}
                />
              </FormDialogBody>
              <FormDialogFooter errorMessage={errorMessage}>
                {cancelButton}
                <SubmitButton pending={pending} pendingLabel="Saving…">
                  Save changes
                </SubmitButton>
              </FormDialogFooter>
            </FormWithAction>
          </TabsContent>
          <TabsContent
            value="usage"
            className="min-h-0 space-y-3 overflow-y-auto px-6 py-5"
          >
            {usageState.status === "loading" ? (
              <p className="text-sm text-muted-foreground">
                Loading pipeline usage…
              </p>
            ) : null}
            {usageState.status === "error" ? (
              <div className="space-y-3">
                <FormErrorAlert message={usageState.errorMessage} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={retry}
                >
                  Retry
                </Button>
              </div>
            ) : null}
            {usageState.status === "loaded" ? (
              <PipelineUsageList
                usages={usageState.usages}
                emptyMessage="This variable is not referenced by any pipelines yet."
                ariaLabel={`Pipelines using variable ${variable.key}`}
              />
            ) : null}
            {usageState.status === "idle" ? (
              <p className="text-sm text-muted-foreground">
                Open this tab to load pipeline usage.
              </p>
            ) : null}
          </TabsContent>
        </Tabs>
      ) : null}
    </FormDialogContent>
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
