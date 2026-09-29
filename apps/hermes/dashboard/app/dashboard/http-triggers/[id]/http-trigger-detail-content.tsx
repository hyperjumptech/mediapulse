"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Copy, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";

import { BreadcrumbEntityLabel } from "@/components/breadcrumb-entity-label";
import { CopyableId } from "@/components/copyable-id";
import { PageHeader } from "@/components/page-header";
import { DateTime } from "@/components/date-time/date-time";
import { StatusBadge } from "@/components/status-badge";
import { SummaryGrid, SummaryItem } from "@/components/summary-grid";
import {
  buildHttpTriggerInvokeCurlCommand,
  type HttpTriggerInvokeMethod,
} from "@/lib/http-trigger-invoke-curl";
import type { getHttpTriggerById } from "@/lib/http-triggers";

import type { PipelineOption } from "../../schedules/schedule-form-fields";
import { HttpTriggerFormModal } from "../http-trigger-form-modal";

type TriggerWithPipeline = NonNullable<
  Awaited<ReturnType<typeof getHttpTriggerById>>
>;

const useHttpTriggerDetailState = (
  triggerId: string,
  method: HttpTriggerInvokeMethod,
) => {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [siteOrigin, setSiteOrigin] = useState("");

  useEffect(() => {
    setSiteOrigin(window.location.origin);
  }, []);

  const openEditModal = () => setEditModalOpen(true);

  const copyCurlCommand = useCallback(async () => {
    const command = buildHttpTriggerInvokeCurlCommand({
      method,
      triggerId,
      origin: window.location.origin,
    });
    try {
      await navigator.clipboard.writeText(command);
      toast.success("cURL command copied");
    } catch {
      toast.error("Couldn't copy the cURL command");
    }
  }, [triggerId, method]);

  return {
    editModalOpen,
    setEditModalOpen,
    openEditModal,
    siteOrigin,
    copyCurlCommand,
  };
};

export const HttpTriggerDetailContent = ({
  trigger,
  executionsSection,
  pipelines,
}: {
  trigger: TriggerWithPipeline;
  executionsSection: ReactNode;
  pipelines: PipelineOption[];
}) => {
  const {
    editModalOpen,
    setEditModalOpen,
    openEditModal,
    siteOrigin,
    copyCurlCommand,
  } = useHttpTriggerDetailState(trigger.id, trigger.method);
  const invokePath = `/api/http-triggers/${trigger.id}/invoke`;
  const invokeUrl = `${siteOrigin}${invokePath}`;
  const enabledStatus = trigger.enabled ? "enabled" : "disabled";
  const pipelineHref = `/dashboard/pipelines/${trigger.pipeline.id}`;
  const description = trigger.description ?? undefined;

  return (
    <>
      <BreadcrumbEntityLabel segment={trigger.id} label={trigger.name} />
      <div className="flex flex-col gap-6">
        <PageHeader
          badges={<StatusBadge status={enabledStatus} />}
          description={description}
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => void copyCurlCommand()}
              >
                <Copy aria-hidden />
                Copy cURL
              </Button>
              <Button type="button" variant="outline" onClick={openEditModal}>
                <Pencil aria-hidden />
                Edit HTTP trigger
              </Button>
            </>
          }
        />
        <SummaryGrid>
          <SummaryItem label="Pipeline">
            <Link
              href={pipelineHref}
              className="font-medium underline-offset-4 hover:underline"
            >
              {trigger.pipeline.name}
            </Link>
          </SummaryItem>
          <SummaryItem label="Method">
            <Badge
              variant="outline"
              className="px-1.5 font-mono text-muted-foreground"
            >
              {trigger.method}
            </Badge>
          </SummaryItem>
          <SummaryItem label="Last triggered">
            {trigger.lastTriggeredAt ? (
              <DateTime
                value={trigger.lastTriggeredAt}
                variant="both"
                style="datetime"
              />
            ) : (
              <span className="text-muted-foreground">Never</span>
            )}
          </SummaryItem>
          {trigger.tokenHint ? (
            <SummaryItem label="Token hint">
              <code className="font-mono text-xs">{trigger.tokenHint}</code>
            </SummaryItem>
          ) : null}
          <SummaryItem label="Invoke URL" wide>
            <CopyableId value={invokeUrl} label="Copy invoke URL" />
          </SummaryItem>
        </SummaryGrid>
        <section>{executionsSection}</section>
      </div>
      <HttpTriggerFormModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        mode="edit"
        editHttpTriggerId={trigger.id}
        pipelines={pipelines}
      />
    </>
  );
};
