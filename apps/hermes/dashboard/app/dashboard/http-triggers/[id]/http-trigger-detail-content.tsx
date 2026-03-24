"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { ListPagination } from "@/components/list-pagination";
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
  return { editModalOpen, setEditModalOpen };
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
  const { editModalOpen, setEditModalOpen } = useHttpTriggerDetailState();
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
            <p className="mt-1 text-sm text-muted-foreground">
              Token hint: {trigger.tokenHint ?? "not available"}
            </p>
            <p className="text-muted-foreground">
              {trigger.description ??
                "View executions and edit HTTP trigger settings."}
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
