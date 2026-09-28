import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  EntityFormModalCreateButton,
  EntityFormModalProvider,
} from "@/components/entity-form-modal-provider";
import type { SchedulesPageResult } from "@/lib/schedules";

import {
  SchedulesWithModal,
  type SchedulesWithModalProps,
} from "./schedules-with-modal";

type ScheduleRow = SchedulesPageResult["schedules"][number];

vi.mock("@/components/list-pagination", () => ({
  ListPagination: ({ page, total }: { page: number; total: number }) => (
    <nav data-testid="pagination" data-page={page} data-total={total}>
      Pagination
    </nav>
  ),
}));

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

vi.mock("./schedules-search", () => ({
  SchedulesSearch: ({ initialQuery }: { initialQuery?: string }) => (
    <div data-testid="schedules-search" data-query={initialQuery ?? ""} />
  ),
}));

vi.mock("./schedules-table", () => ({
  SchedulesTable: ({
    schedules,
    onEdit,
    onCreate,
  }: {
    schedules: Array<{ id: string }>;
    onEdit: (scheduleId: string) => void;
    onCreate: () => void;
  }) => (
    <div data-testid="schedules-table" data-count={schedules.length}>
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
  currentPage: 1,
  pageSize: 15,
  total: 0,
  sortBy: "name",
  sortDir: "asc",
};

const renderWithProvider = (props: Partial<SchedulesWithModalProps> = {}) =>
  render(
    <EntityFormModalProvider>
      <EntityFormModalCreateButton label="New schedule" />
      <SchedulesWithModal {...baseProps} {...props} />
    </EntityFormModalProvider>,
  );

describe("SchedulesWithModal", () => {
  it("renders search, table, pagination, and a closed modal", () => {
    // Act
    renderWithProvider({
      schedules: [createMockSchedule("1", "Schedule A")],
      currentPage: 2,
      total: 30,
      searchQuery: "daily",
    });

    // Assert
    expect(screen.getByTestId("schedules-search")).toHaveAttribute(
      "data-query",
      "daily",
    );
    expect(screen.getByTestId("schedules-table")).toHaveAttribute(
      "data-count",
      "1",
    );
    expect(screen.getByTestId("pagination")).toHaveAttribute("data-page", "2");
    expect(screen.getByTestId("pagination")).toHaveAttribute(
      "data-total",
      "30",
    );
    expect(screen.getByTestId("schedule-form-modal")).toHaveAttribute(
      "data-open",
      "false",
    );
  });

  it("opens the create modal from the page header button", () => {
    // Setup
    renderWithProvider();

    // Act
    fireEvent.click(screen.getByRole("button", { name: "New schedule" }));

    // Assert
    const modal = screen.getByTestId("schedule-form-modal");

    expect(modal).toHaveAttribute("data-open", "true");
    expect(modal).toHaveAttribute("data-mode", "create");
  });

  it("opens the create modal from the empty state", () => {
    // Setup
    renderWithProvider();

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Empty state create" }));

    // Assert
    expect(screen.getByTestId("schedule-form-modal")).toHaveAttribute(
      "data-mode",
      "create",
    );
  });

  it("opens the edit modal for the selected row", () => {
    // Setup
    renderWithProvider({
      schedules: [createMockSchedule("schedule-1", "Schedule A")],
      total: 1,
    });

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Edit schedule-1" }));

    // Assert
    const modal = screen.getByTestId("schedule-form-modal");

    expect(modal).toHaveAttribute("data-open", "true");
    expect(modal).toHaveAttribute("data-mode", "edit");
    expect(modal).toHaveAttribute("data-edit-id", "schedule-1");
  });
});
