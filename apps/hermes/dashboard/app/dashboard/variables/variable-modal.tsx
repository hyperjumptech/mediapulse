"use client";

import { Dialog } from "@workspace/ui/components/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import { Button } from "@workspace/ui/components/button";

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

import {
  useVariableModalState,
  useVariableUsageState,
  type VariableModalProps,
  type VariableModalTab,
} from "./use-variable-modal-state";
import { VariableFormFields } from "./variable-form-fields";

export type { VariableModalProps };

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

  if (!isCreate && variable == null) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpenRef.current}>
      {dialogContent}
    </Dialog>
  );
};
