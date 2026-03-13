import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SchedulesWithModal } from "./schedules-with-modal";
import type { SchedulesPageResult } from "@/lib/schedules";

type ScheduleRow = SchedulesPageResult["schedules"][number];

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({
    children,
    onClick,
  }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

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
  }: {
    schedules: Array<{ id: string }>;
    onEdit?: (id: string) => void;
  }) => (
    <div data-testid="schedules-table" data-count={schedules.length}>
      {schedules.map((s) => (
        <button
          key={s.id}
          data-testid={`edit-${s.id}`}
          onClick={() => onEdit?.(s.id)}
        >
          Edit {s.id}
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

describe("SchedulesWithModal", () => {
  it("renders create schedule button", () => {
    // Act
    render(
      <SchedulesWithModal
        schedules={[]}
        pipelines={[]}
        currentPage={1}
        pageSize={15}
        total={0}
        sortBy="name"
        sortDir="asc"
      />,
    );

    // Assert
    expect(
      screen.getByRole("button", { name: "Create schedule" }),
    ).toBeInTheDocument();
  });

  it("renders schedules table", () => {
    // Setup
    const schedules = [createMockSchedule("1", "Schedule A")];

    // Act
    render(
      <SchedulesWithModal
        schedules={schedules}
        pipelines={[]}
        currentPage={1}
        pageSize={15}
        total={1}
        sortBy="name"
        sortDir="asc"
      />,
    );

    // Assert
    expect(screen.getByTestId("schedules-table")).toBeInTheDocument();
    expect(screen.getByTestId("schedules-table")).toHaveAttribute(
      "data-count",
      "1",
    );
  });

  it("renders schedule form modal", () => {
    // Act
    render(
      <SchedulesWithModal
        schedules={[]}
        pipelines={[]}
        currentPage={1}
        pageSize={15}
        total={0}
        sortBy="name"
        sortDir="asc"
      />,
    );

    // Assert
    expect(screen.getByTestId("schedule-form-modal")).toBeInTheDocument();
  });

  it("renders search component", () => {
    // Act
    render(
      <SchedulesWithModal
        schedules={[]}
        pipelines={[]}
        currentPage={1}
        pageSize={15}
        total={0}
        searchQuery="daily"
        sortBy="name"
        sortDir="asc"
      />,
    );

    // Assert
    expect(screen.getByTestId("schedules-search")).toHaveAttribute(
      "data-query",
      "daily",
    );
  });

  it("renders pagination", () => {
    // Act
    render(
      <SchedulesWithModal
        schedules={[]}
        pipelines={[]}
        currentPage={2}
        pageSize={15}
        total={30}
        sortBy="name"
        sortDir="asc"
      />,
    );

    // Assert
    expect(screen.getByTestId("pagination")).toHaveAttribute("data-page", "2");
    expect(screen.getByTestId("pagination")).toHaveAttribute(
      "data-total",
      "30",
    );
  });

  it("opens create modal when clicking create button", () => {
    // Act
    render(
      <SchedulesWithModal
        schedules={[]}
        pipelines={[]}
        currentPage={1}
        pageSize={15}
        total={0}
        sortBy="name"
        sortDir="asc"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Create schedule" }));

    // Assert
    expect(screen.getByTestId("schedule-form-modal")).toHaveAttribute(
      "data-open",
      "true",
    );
    expect(screen.getByTestId("schedule-form-modal")).toHaveAttribute(
      "data-mode",
      "create",
    );
  });

  it("opens edit modal when clicking edit in table", () => {
    // Setup
    const schedules = [createMockSchedule("schedule-1", "Schedule A")];

    // Act
    render(
      <SchedulesWithModal
        schedules={schedules}
        pipelines={[]}
        currentPage={1}
        pageSize={15}
        total={1}
        sortBy="name"
        sortDir="asc"
      />,
    );

    fireEvent.click(screen.getByTestId("edit-schedule-1"));

    // Assert
    expect(screen.getByTestId("schedule-form-modal")).toHaveAttribute(
      "data-open",
      "true",
    );
    expect(screen.getByTestId("schedule-form-modal")).toHaveAttribute(
      "data-mode",
      "edit",
    );
    expect(screen.getByTestId("schedule-form-modal")).toHaveAttribute(
      "data-edit-id",
      "schedule-1",
    );
  });
});
