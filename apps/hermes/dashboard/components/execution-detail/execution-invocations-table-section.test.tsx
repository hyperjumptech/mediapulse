import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ScheduleExecutionInvocationsTableProps } from "@/components/schedule-execution-invocations-table";

import { ExecutionInvocationsTableSection } from "./execution-invocations-table-section";

const { tablePropsMock } = vi.hoisted(() => ({ tablePropsMock: vi.fn() }));

vi.mock("@/lib/data-table/read-column-visibility", () => ({
  readColumnVisibility: async (tableId: string) =>
    tableId === "execution-invocations" ? { jobId: true } : {},
}));

vi.mock("@/components/schedule-execution-invocations-table", () => ({
  ScheduleExecutionInvocationsTable: (
    props: ScheduleExecutionInvocationsTableProps,
  ) => {
    tablePropsMock(props);

    return <div data-testid="invocations-table" />;
  },
}));

describe("ExecutionInvocationsTableSection", () => {
  it("starts the invocations table from the columns people saved", async () => {
    render(
      await ExecutionInvocationsTableSection({
        invocations: [],
        payloadSource: {
          kind: "schedule",
          scheduleId: "s",
          scheduleExecutionId: "e",
        },
      } as unknown as ScheduleExecutionInvocationsTableProps),
    );

    expect(screen.getByTestId("invocations-table")).toBeInTheDocument();
    expect(tablePropsMock).toHaveBeenCalledWith(
      expect.objectContaining({ initialColumnVisibility: { jobId: true } }),
    );
  });
});
