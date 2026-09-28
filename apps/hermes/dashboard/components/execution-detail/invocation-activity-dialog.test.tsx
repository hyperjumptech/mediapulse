import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ActivityRow } from "@/components/use-agent-activity-modal";

import { InvocationActivityDialog } from "./invocation-activity-dialog";

const activityRow = (overrides: Partial<ActivityRow>): ActivityRow => ({
  id: "row-1",
  title: "Fetched sources",
  description: null,
  status: "completed",
  createdAt: "2026-09-28T10:00:00.000Z",
  durationMs: 45_000,
  ...overrides,
});

const renderDialog = (
  props: Partial<React.ComponentProps<typeof InvocationActivityDialog>>,
) =>
  render(
    <InvocationActivityDialog
      open
      jobId="job-12345678-abcd"
      outcome="success"
      rows={[]}
      loading={false}
      onOpenChange={vi.fn()}
      {...props}
    />,
  );

describe("InvocationActivityDialog", () => {
  it("shows a spinner while activity loads", () => {
    // Act
    renderDialog({ loading: true, rows: null });

    // Assert
    expect(
      screen.getByRole("status", { name: "Loading activity" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Activity for job-1234…")).toBeInTheDocument();
  });

  it("lists completed steps with their durations and descriptions", () => {
    // Act
    renderDialog({
      rows: [
        activityRow({ id: "row-1", description: "12 sources" }),
        activityRow({ id: "row-2", title: "Summarized", durationMs: null }),
      ],
    });

    // Assert
    expect(screen.getByText("Fetched sources")).toBeInTheDocument();
    expect(screen.getByText("12 sources")).toBeInTheDocument();
    expect(screen.getByText("45s")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Completed")).toHaveLength(2);
  });

  it("marks the last step as failed when the job failed", () => {
    // Act
    renderDialog({
      outcome: "failure",
      rows: [
        activityRow({ id: "row-1" }),
        activityRow({ id: "row-2", title: "Summarized" }),
      ],
    });

    // Assert
    expect(screen.getAllByLabelText("Completed")).toHaveLength(1);
    expect(screen.getByLabelText("Failed")).toBeInTheDocument();
  });

  it("spins on the last processing step of a running job", () => {
    // Act
    renderDialog({
      outcome: "running",
      rows: [
        activityRow({ id: "row-1" }),
        activityRow({
          id: "row-2",
          title: "Summarizing",
          status: "processing",
        }),
      ],
    });

    // Assert
    expect(
      screen.getByRole("status", { name: "In progress" }),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText("Completed")).toHaveLength(1);
  });

  it("says when no activity was recorded", () => {
    // Act
    renderDialog({ rows: [], jobId: null });

    // Assert
    expect(screen.getByText("No activity recorded.")).toBeInTheDocument();
    expect(screen.getByText("Activity")).toBeInTheDocument();
  });
});
