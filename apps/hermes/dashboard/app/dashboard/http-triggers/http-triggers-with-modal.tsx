"use client";

import { useEntityFormModal } from "@/components/entity-form-modal-provider";
import { ListPagination } from "@/components/list-pagination";
import type {
  HttpTriggersPageResult,
  HttpTriggerSortDir,
  HttpTriggerSortField,
} from "@/lib/http-triggers";

import type { PipelineOption } from "../schedules/schedule-form-fields";
import { HttpTriggerFormModal } from "./http-trigger-form-modal";
import { HttpTriggersSearch } from "./http-triggers-search";
import { HttpTriggersTable } from "./http-triggers-table";

type HttpTriggerRow = HttpTriggersPageResult["httpTriggers"][number];

export type HttpTriggersWithModalProps = {
  httpTriggers: HttpTriggerRow[];
  pipelines: PipelineOption[];
  currentPage: number;
  pageSize: number;
  total: number;
  searchQuery?: string;
  sortBy: HttpTriggerSortField;
  sortDir: HttpTriggerSortDir;
};

export const HttpTriggersWithModal = ({
  httpTriggers,
  pipelines,
  currentPage,
  pageSize,
  total,
  searchQuery,
  sortBy,
  sortDir,
}: HttpTriggersWithModalProps) => {
  const { open, setOpen, mode, editId, openCreate, openEdit } =
    useEntityFormModal();

  return (
    <>
      <div className="flex flex-col gap-3">
        <HttpTriggersSearch
          initialQuery={searchQuery ?? ""}
          pageSize={pageSize}
          sortBy={sortBy}
          sortDir={sortDir}
        />
        <HttpTriggersTable
          httpTriggers={httpTriggers}
          sortBy={sortBy}
          sortDir={sortDir}
          pageSize={pageSize}
          searchQuery={searchQuery}
          onEdit={openEdit}
          onCreate={openCreate}
        />
        <ListPagination
          basePath="/dashboard/http-triggers"
          page={currentPage}
          pageSize={pageSize}
          total={total}
          ariaLabel="HTTP triggers list pagination"
          searchQuery={searchQuery}
          sortBy={sortBy}
          sortDir={sortDir}
        />
      </div>
      <HttpTriggerFormModal
        open={open}
        onOpenChange={setOpen}
        mode={mode}
        editHttpTriggerId={editId}
        pipelines={pipelines}
      />
    </>
  );
};
