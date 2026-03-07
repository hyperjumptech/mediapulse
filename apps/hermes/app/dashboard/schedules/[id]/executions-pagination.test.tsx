import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExecutionsPagination } from "./executions-pagination";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    "aria-label"?: string;
  }) => (
    <a href={href} aria-label={props["aria-label"]}>
      {children}
    </a>
  ),
}));

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({
    children,
    disabled,
    asChild,
  }: React.PropsWithChildren<{ disabled?: boolean; asChild?: boolean }>) =>
    asChild ? (
      <>{children}</>
    ) : (
      <button type="button" disabled={disabled}>
        {children}
      </button>
    ),
}));

describe("ExecutionsPagination", () => {
  it("returns null when total is 0 and pageSize is 15", () => {
    const { container } = render(
      <ExecutionsPagination
        scheduleId="sched-1"
        page={1}
        pageSize={15}
        total={0}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when single page and total <= pageSize", () => {
    const { container } = render(
      <ExecutionsPagination
        scheduleId="sched-1"
        page={1}
        pageSize={10}
        total={5}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders pagination when total exceeds pageSize", () => {
    render(
      <ExecutionsPagination
        scheduleId="sched-1"
        page={1}
        pageSize={10}
        total={25}
      />,
    );
    expect(
      screen.getByRole("navigation", { name: "Executions pagination" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 3 (25 total)")).toBeInTheDocument();
    const nextLink = screen.getByRole("link", { name: "Next page" });
    expect(nextLink).toHaveAttribute(
      "href",
      "/dashboard/schedules/sched-1?page=2&size=10",
    );
  });

  it("renders Previous and Next links when on middle page", () => {
    render(
      <ExecutionsPagination
        scheduleId="sched-1"
        page={2}
        pageSize={10}
        total={25}
      />,
    );
    const prevLink = screen.getByRole("link", { name: "Previous page" });
    const nextLink = screen.getByRole("link", { name: "Next page" });
    expect(prevLink).toHaveAttribute(
      "href",
      "/dashboard/schedules/sched-1?page=1&size=10",
    );
    expect(nextLink).toHaveAttribute(
      "href",
      "/dashboard/schedules/sched-1?page=3&size=10",
    );
  });

  it("builds correct href for page 2", () => {
    render(
      <ExecutionsPagination
        scheduleId="sched-2"
        page={2}
        pageSize={15}
        total={50}
      />,
    );
    const prevLink = screen.getByRole("link", { name: "Previous page" });
    expect(prevLink).toHaveAttribute(
      "href",
      "/dashboard/schedules/sched-2?page=1&size=15",
    );
  });
});
