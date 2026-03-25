"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Copy, GitBranch } from "lucide-react";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { ListPagination } from "@/components/list-pagination";
import { buildHttpTriggerInvokeCurlCommand } from "@/lib/http-trigger-invoke-curl";
import { formatCreatedBy } from "@/lib/format-created-by";
import type {
  getHttpTriggerById,
  HttpTriggerExecutionRow,
} from "@/lib/http-triggers";
import type { PipelineOption } from "../../schedules/schedule-form-fields";
import { HttpTriggerFormModal } from "../http-trigger-form-modal";
import { ExecutionsTable } from "./executions-table";

type TriggerWithPipeline = NonNullable<
  Awaited<ReturnType<typeof getHttpTriggerById>>
>;

const useHttpTriggerDetailState = () => {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [siteOrigin, setSiteOrigin] = useState("");
  useEffect(() => {
    setSiteOrigin(window.location.origin);
  }, []);
  return { editModalOpen, setEditModalOpen, siteOrigin };
};

/**
 * Detail page content for one HTTP trigger.
 */
export const HttpTriggerDetailContent = ({
  trigger,
  executions,
  totalExecutions,
  currentPage,
  pageSize,
  pipelines,
}: {
  trigger: TriggerWithPipeline;
  executions: HttpTriggerExecutionRow[];
  totalExecutions: number;
  currentPage: number;
  pageSize: number;
  pipelines: PipelineOption[];
}) => {
  const { editModalOpen, setEditModalOpen, siteOrigin } =
    useHttpTriggerDetailState();
  const invokePath = `/api/http-triggers/${trigger.id}/invoke`;
  const invokeDisplayUrl = siteOrigin
    ? `${siteOrigin}${invokePath}`
    : invokePath;

  const onCopyInvokeCurl = useCallback(async () => {
    const command = buildHttpTriggerInvokeCurlCommand({
      method: trigger.method,
      triggerId: trigger.id,
      origin: window.location.origin,
    });
    try {
      await navigator.clipboard.writeText(command);
      window.alert("cURL command copied to clipboard.");
    } catch {
      window.alert("Failed to copy cURL command.");
    }
  }, [trigger.id, trigger.method]);

  return (
    <>
      <div className="flex flex-col gap-6">
        <div>
          <Link
            href="/dashboard/http-triggers"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            Back to HTTP triggers
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-foreground">
                {trigger.name}
              </h1>
              <Badge variant={trigger.enabled ? "success" : "secondary"}>
                {trigger.enabled ? "Enabled" : "Disabled"}
              </Badge>
              <Badge variant="outline">{trigger.method}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-muted-foreground">
              <Link
                href={`/dashboard/pipelines/${trigger.pipeline.id}`}
                className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline"
              >
                <GitBranch className="size-4 shrink-0" aria-hidden />
                {trigger.pipeline.name}
              </Link>
              <span className="text-muted-foreground/60" aria-hidden>
                ·
              </span>
              <code className="max-w-full break-all rounded-md bg-muted px-2 py-1 font-mono text-xs text-foreground">
                {invokeDisplayUrl}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => void onCopyInvokeCurl()}
              >
                <Copy className="mr-2 size-4" aria-hidden />
                Copy cURL
              </Button>
            </div>
            <p className="text-muted-foreground">
              {trigger.description ??
                "View executions and edit HTTP trigger settings."}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Created by: </span>
              {formatCreatedBy(trigger.createdBy, trigger.createdById)}
            </p>
          </div>
          <Button variant="outline" onClick={() => setEditModalOpen(true)}>
            Edit HTTP trigger
          </Button>
        </div>

        <section>
          <h2 className="mb-2 text-lg font-medium text-foreground">
            Executions
          </h2>
          <ExecutionsTable triggerId={trigger.id} executions={executions} />
          <div className="mt-4">
            <ListPagination
              basePath={`/dashboard/http-triggers/${trigger.id}`}
              page={currentPage}
              pageSize={pageSize}
              total={totalExecutions}
              ariaLabel="HTTP trigger executions pagination"
            />
          </div>
        </section>
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
