import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EntityFormModalProvider } from "@/components/entity-form-modal-provider";

import type { ScheduleRow } from "./schedules-table";
import {
  SchedulesWithModal,
  type SchedulesWithModalProps,
} from "./schedules-with-modal";

const { searchParams } = vi.hoisted(() => ({
  searchParams: { current: "" },
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useSearchParams: () => new URLSearchParams(searchParams.current),
}));

afterEach(() => {
  searchParams.current = "";
});

vi.mock("./schedule-form-modal", () => ({
  ScheduleFormModal: ({
    open,
    mode,
    editScheduleId,
  }: {
    open: boolean;
    mode: string;
    editScheduleId: string | null;
  }) => (
    <div
      data-testid="schedule-form-modal"
      data-open={open}
      data-mode={mode}
      data-edit-id={editScheduleId ?? "none"}
    />
  ),
}));

vi.mock("./schedules-table", () => ({
  SchedulesTable: ({
    schedules,
    urlState,
    initialColumnVisibility,
    onEdit,
    onCreate,
  }: {
    schedules: Array<{ id: string }>;
    urlState: { total: number; search?: string };
    initialColumnVisibility?: Record<string, boolean>;
    onEdit: (scheduleId: string) => void;
    onCreate: () => void;
  }) => (
    <div
      data-testid="schedules-table"
      data-count={schedules.length}
      data-total={urlState.total}
      data-search={urlState.search ?? ""}
      data-visibility={JSON.stringify(initialColumnVisibility ?? {})}
    >
      <button type="button" onClick={onCreate}>
        Empty state create
      </button>
      {schedules.map((schedule) => (
        <button
          key={schedule.id}
          type="button"
          onClick={() => onEdit(schedule.id)}
        >
          Edit {schedule.id}
        </button>
      ))}
    </div>
  ),
}));

const createMockSchedule = (id: string, name: string): ScheduleRow =>
  ({
    id,
    name,
    repeat: "repeating",
    enabled: true,
    nextRunAt: new Date("2024-01-15"),
    pipeline: { id: "pipeline-1", name: "Test Pipeline" },
    createdAt: new Date("2024-01-01"),
  }) as ScheduleRow;

const baseProps: SchedulesWithModalProps = {
  schedules: [],
  pipelines: [],
  pipelineValidationById: {},
  urlState: {
    basePath: "/dashboard/schedules",
    page: 1,
    pageSize: 15,
    total: 0,
    sortBy: "name",
    sortDir: "asc",
  },
};

const renderWithProvider = (props: Partial<SchedulesWithModalProps> = {}) =>
  render(
    <EntityFormModalProvider>
      <SchedulesWithModal {...baseProps} {...props} />
    </EntityFormModalProvider>,
  );

describe("SchedulesWithModal", () => {
  it("hands the table its rows, URL state and column choices next to a closed modal", () => {
    renderWithProvider({
      schedules: [createMockSchedule("1", "Schedule A")],
      urlState: { ...baseProps.urlState, total: 30, search: "daily" },
      initialColumnVisibility: { repeats: false },
    });

    const table = screen.getByTestId("schedules-table");

    expect(table).toHaveAttribute("data-count", "1");
    expect(table).toHaveAttribute("data-total", "30");
    expect(table).toHaveAttribute("data-search", "daily");
    expect(table).toHaveAttribute(
      "data-visibility",
      JSON.stringify({ repeats: false }),
    );
    expect(screen.getByTestId("schedule-form-modal")).toHaveAttribute(
      "data-open",
      "false",
    );
  });

  it("opens the create modal when the header link asks for it", () => {
    searchParams.current = "create=1";

    renderWithProvider();

    const modal = screen.getByTestId("schedule-form-modal");

    expect(modal).toHaveAttribute("data-open", "true");
    expect(modal).toHaveAttribute("data-mode", "create");
  });

  it("opens the create modal from the empty state", () => {
    renderWithProvider();

    fireEvent.click(screen.getByRole("button", { name: "Empty state create" }));

    const modal = screen.getByTestId("schedule-form-modal");

    expect(modal).toHaveAttribute("data-open", "true");
    expect(modal).toHaveAttribute("data-mode", "create");
  });

  it("opens the edit modal for the selected row", () => {
    renderWithProvider({
      schedules: [createMockSchedule("schedule-1", "Schedule A")],
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit schedule-1" }));

    const modal = screen.getByTestId("schedule-form-modal");

    expect(modal).toHaveAttribute("data-open", "true");
    expect(modal).toHaveAttribute("data-mode", "edit");
    expect(modal).toHaveAttribute("data-edit-id", "schedule-1");
  });
});
