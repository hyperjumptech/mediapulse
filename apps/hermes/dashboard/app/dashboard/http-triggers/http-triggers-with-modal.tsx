"use client";

import { useCallback, useState } from "react";

import { Button } from "@workspace/ui/components/button";
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

const useHttpTriggersWithModalState = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editHttpTriggerId, setEditHttpTriggerId] = useState<string | null>(
    null,
  );
  const openCreateModal = useCallback(() => {
    setModalMode("create");
    setEditHttpTriggerId(null);
    setModalOpen(true);
  }, []);
  const openEditModal = useCallback((triggerId: string) => {
    setModalMode("edit");
    setEditHttpTriggerId(triggerId);
    setModalOpen(true);
  }, []);
  return {
    modalOpen,
    setModalOpen,
    modalMode,
    editHttpTriggerId,
    openCreateModal,
    openEditModal,
  };
};

/**
 * Client wrapper for trigger list with create/edit modal.
 */
export const HttpTriggersWithModal = ({
  httpTriggers,
  pipelines,
  currentPage,
  pageSize,
  total,
  searchQuery,
  sortBy,
  sortDir,
}: {
  httpTriggers: HttpTriggerRow[];
  pipelines: PipelineOption[];
  currentPage: number;
  pageSize: number;
  total: number;
  searchQuery?: string;
  sortBy: HttpTriggerSortField;
  sortDir: HttpTriggerSortDir;
}) => {
  const {
    modalOpen,
    setModalOpen,
    modalMode,
    editHttpTriggerId,
    openCreateModal,
    openEditModal,
  } = useHttpTriggersWithModalState();

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col justify-between sm:flex-row sm:items-center">
          <HttpTriggersSearch
            initialQuery={searchQuery ?? ""}
            pageSize={pageSize}
            sortBy={sortBy}
            sortDir={sortDir}
          />
          <div className="shrink-0 sm:ml-auto">
            <Button onClick={openCreateModal}>Create HTTP trigger</Button>
          </div>
        </div>
        <HttpTriggersTable
          httpTriggers={httpTriggers}
          sortBy={sortBy}
          sortDir={sortDir}
          pageSize={pageSize}
          searchQuery={searchQuery}
          onEdit={openEditModal}
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
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode={modalMode}
        editHttpTriggerId={editHttpTriggerId}
        pipelines={pipelines}
      />
    </>
  );
};
