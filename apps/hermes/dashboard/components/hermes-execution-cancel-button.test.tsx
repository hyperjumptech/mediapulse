/** @vitest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HermesExecutionCancelButton } from "./hermes-execution-cancel-button";

const routerRefreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: routerRefreshMock,
  }),
}));

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({
    children,
    type,
    disabled,
    onClick,
  }: React.PropsWithChildren<{
    type?: string;
    disabled?: boolean;
    onClick?: () => void;
  }>) => (
    <button type={type as "button"} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}));

const scheduleTarget = {
  kind: "schedule" as const,
  scheduleId: "00000000-0000-4000-8000-000000000001",
  scheduleExecutionId: "00000000-0000-4000-8000-000000000002",
};

describe("HermesExecutionCancelButton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    routerRefreshMock.mockReset();
  });

  it("renders nothing when the run cannot be cancelled", () => {
    render(
      <HermesExecutionCancelButton
        target={scheduleTarget}
        runStatus="succeeded"
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("posts cancel and refreshes when clicked for a pending run", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <HermesExecutionCancelButton
        target={scheduleTarget}
        runStatus="pending"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Cancel run/i }));

    await waitFor(() => {
      expect(routerRefreshMock).toHaveBeenCalled();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/dashboard/schedules/actions/cancel-execution",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
