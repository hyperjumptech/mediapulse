"use client";

import { useState } from "react";

import { Button } from "@workspace/ui/components/button";
import type { ScheduleSortDir, ScheduleSortField } from "@/lib/schedules";
import type { SchedulesPageResult } from "@/lib/schedules";
import type { PipelineOption } from "./schedule-form-fields";

import { ListPagination } from "@/components/list-pagination";
import { ScheduleFormModal } from "./schedule-form-modal";
import { SchedulesSearch } from "./schedules-search";
import { SchedulesTable } from "./schedules-table";

type ScheduleRow = SchedulesPageResult["schedules"][number];

export type SchedulesWithModalProps = {
  schedules: ScheduleRow[];
  pipelines: PipelineOption[];
  currentPage: number;
  pageSize: number;
  total: number;
  searchQuery?: string;
  sortBy: ScheduleSortField;
  sortDir: ScheduleSortDir;
};

/**
 * Client wrapper that provides Create/Edit schedule modals and wires table row Edit to open the modal.
 */
export const SchedulesWithModal = ({
  schedules,
  pipelines,
  currentPage,
  pageSize,
  total,
  searchQuery,
  sortBy,
  sortDir,
}: SchedulesWithModalProps) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editScheduleId, setEditScheduleId] = useState<string | null>(null);

  const openCreateModal = () => {
    setModalMode("create");
    setEditScheduleId(null);
    setModalOpen(true);
  };

  const openEditModal = (scheduleId: string) => {
    setModalMode("edit");
    setEditScheduleId(scheduleId);
    setModalOpen(true);
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col justify-between sm:flex-row sm:items-center">
          <SchedulesSearch
            initialQuery={searchQuery ?? ""}
            pageSize={pageSize}
            sortBy={sortBy}
            sortDir={sortDir}
          />
          <div className="shrink-0 sm:ml-auto">
            <Button onClick={openCreateModal}>Create schedule</Button>
          </div>
        </div>
        <SchedulesTable
          schedules={schedules}
          sortBy={sortBy}
          sortDir={sortDir}
          pageSize={pageSize}
          searchQuery={searchQuery}
          onEdit={openEditModal}
        />
        <ListPagination
          basePath="/dashboard/schedules"
          page={currentPage}
          pageSize={pageSize}
          total={total}
          ariaLabel="Schedules list pagination"
          searchQuery={searchQuery}
          sortBy={sortBy}
          sortDir={sortDir}
        />
      </div>
      <ScheduleFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode={modalMode}
        editScheduleId={editScheduleId}
        pipelines={pipelines}
      />
    </>
  );
};
