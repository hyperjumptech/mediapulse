"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Spinner } from "@workspace/ui/components/spinner";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";

import { CopyableId } from "@/components/copyable-id";
import { InvocationOutcomeDetail } from "@/components/invocation-outcome-detail";
import { StatusBadge } from "@/components/status-badge";
import type {
  InvocationPayload,
  ScheduleExecutionInvocationRow,
} from "@/components/use-schedule-execution-invocations-modal";
import { resolveInvocationOutcomeLabel } from "@/lib/invocation-display-status";

type InvocationDetailOpenChangeHandler = (open: boolean) => void;

type InvocationDetailDialogProps = {
  open: boolean;
  selected: ScheduleExecutionInvocationRow | null;
  payload: InvocationPayload | null;
  loading: boolean;
  errorMessage: string | null;
  onOpenChange: InvocationDetailOpenChangeHandler;
};

const JSON_BLOCK_CLASS_NAME =
  "max-h-[50vh] overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed";

const formatJsonBlock = (value: unknown): string => {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value);
  }
};

const InvocationPayloadTabs = ({ payload }: { payload: InvocationPayload }) => {
  const inputJson = formatJsonBlock(payload.inputMasked);
  const configJson =
    payload.configMasked == null ? null : formatJsonBlock(payload.configMasked);

  return (
    <Tabs defaultValue="outcome" className="min-w-0 gap-3">
      <TabsList>
        <TabsTrigger value="outcome">Outcome</TabsTrigger>
        <TabsTrigger value="input">Input</TabsTrigger>
        <TabsTrigger value="config">Config</TabsTrigger>
      </TabsList>
      <TabsContent value="outcome" className="min-w-0">
        <InvocationOutcomeDetail
          transportError={payload.transportError}
          agentResponse={payload.agentResponse}
        />
      </TabsContent>
      <TabsContent value="input" className="min-w-0">
        <pre className={JSON_BLOCK_CLASS_NAME}>{inputJson}</pre>
      </TabsContent>
      <TabsContent value="config" className="min-w-0">
        {configJson == null ? (
          <p className="text-sm text-muted-foreground">
            No config stored for this invocation (older executions only saved
            input).
          </p>
        ) : (
          <pre className={JSON_BLOCK_CLASS_NAME}>{configJson}</pre>
        )}
      </TabsContent>
    </Tabs>
  );
};

const InvocationPayloadBody = ({
  payload,
  loading,
  errorMessage,
}: {
  payload: InvocationPayload | null;
  loading: boolean;
  errorMessage: string | null;
}) => {
  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner
          aria-label="Loading invocation details"
          className="size-6 text-muted-foreground"
        />
      </div>
    );
  }

  if (errorMessage != null) {
    return <p className="text-sm text-destructive">{errorMessage}</p>;
  }

  if (payload == null) {
    return null;
  }

  return <InvocationPayloadTabs payload={payload} />;
};

const InvocationDetailHeader = ({
  selected,
}: {
  selected: ScheduleExecutionInvocationRow | null;
}) => {
  const outcome = selected
    ? resolveInvocationOutcomeLabel(selected.status, selected.semanticStatus)
    : null;

  return (
    <DialogHeader className="gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <DialogTitle>Invocation</DialogTitle>
        {outcome ? <StatusBadge status={outcome} /> : null}
      </div>
      <DialogDescription>
        Input and config as stored for this job. Values that look like
        credentials are hidden.
      </DialogDescription>
      {selected ? (
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <code className="font-mono">{selected.agentId}</code>
          <CopyableId value={selected.jobId} label="Copy job ID" />
        </div>
      ) : null}
    </DialogHeader>
  );
};

export const InvocationDetailDialog = ({
  open,
  selected,
  payload,
  loading,
  errorMessage,
  onOpenChange,
}: InvocationDetailDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto sm:max-w-2xl">
        <InvocationDetailHeader selected={selected} />
        {selected ? (
          <InvocationPayloadBody
            payload={payload}
            loading={loading}
            errorMessage={errorMessage}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
