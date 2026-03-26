import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";

import { ExecutionsTable } from "./executions-table";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const createMockFormWithAction = () => {
  const FormWithAction = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <form
      data-testid="cancel-http-trigger-execution-form"
      className={className}
    >
      {children}
    </form>
  );
  FormWithAction.displayName = "FormWithAction";
  return FormWithAction;
};

vi.mock(
  "@/app/dashboard/http-triggers/actions/cancel-execution/.generated/use-form-action",
  () => ({
    useFormAction: vi.fn(() => ({
      FormWithAction: createMockFormWithAction(),
      state: null,
      pending: false,
    })),
  }),
);

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({
    children,
    type,
    disabled,
  }: React.PropsWithChildren<{ type?: string; disabled?: boolean }>) => (
    <button type={type as "submit"} disabled={disabled}>
      {children}
    </button>
  ),
}));

const getUseFormActionMock = async () => {
  const mod =
    await import("@/app/dashboard/http-triggers/actions/cancel-execution/.generated/use-form-action");
  return mod.useFormAction as Mock;
};

describe("Http Trigger ExecutionsTable", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows cancel action for running execution", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue({
      FormWithAction: createMockFormWithAction(),
      state: null,
      pending: false,
    });

    // Act
    render(
      <ExecutionsTable
        triggerId="trigger-1"
        executions={[
          {
            id: "exec-1",
            executionTime: new Date("2026-03-26T12:00:00.000Z"),
            enqueueStatus: "success",
            runStatus: "running",
            jobsCreated: 1,
            jobsEnqueued: 1,
            succeededInvocationCount: 0,
            failedInvocationCount: 0,
            errors: null,
            createdAt: new Date("2026-03-26T12:00:00.000Z"),
          },
        ]}
      />,
    );

    // Assert
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("does not show cancel action for failed execution", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue({
      FormWithAction: createMockFormWithAction(),
      state: null,
      pending: false,
    });

    // Act
    render(
      <ExecutionsTable
        triggerId="trigger-1"
        executions={[
          {
            id: "exec-1",
            executionTime: new Date("2026-03-26T12:00:00.000Z"),
            enqueueStatus: "success",
            runStatus: "failed",
            jobsCreated: 1,
            jobsEnqueued: 1,
            succeededInvocationCount: 0,
            failedInvocationCount: 0,
            errors: null,
            createdAt: new Date("2026-03-26T12:00:00.000Z"),
          },
        ]}
      />,
    );

    // Assert
    expect(
      screen.queryByRole("button", { name: "Cancel" }),
    ).not.toBeInTheDocument();
  });
});
