import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VariableModal } from "./variable-modal";
import type { VariablesPageResult } from "@/lib/variables";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

const usageMock = vi.fn();

vi.mock("@/app/dashboard/variables/actions/get-usage", () => ({
  getVariablePipelineUsage: (...args: unknown[]) => usageMock(...args),
}));

const createMockFormWithAction = () => {
  const FormWithAction = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <form data-testid="form-with-action" className={className}>
      {children}
    </form>
  );
  FormWithAction.displayName = "FormWithAction";
  return FormWithAction;
};

const useCreateFormActionMock = vi.fn(() => ({
  FormWithAction: createMockFormWithAction(),
  state: null,
  pending: false,
}));

const useUpdateFormActionMock = vi.fn(() => ({
  FormWithAction: createMockFormWithAction(),
  state: null,
  pending: false,
}));

vi.mock(
  "@/app/dashboard/variables/actions/create/.generated/use-form-action",
  () => ({
    useFormAction: () => useCreateFormActionMock(),
  }),
);

vi.mock(
  "@/app/dashboard/variables/actions/update/.generated/use-form-action",
  () => ({
    useFormAction: () => useUpdateFormActionMock(),
  }),
);

vi.mock("@workspace/ui/components/dialog", () => ({
  Dialog: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogContent: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
}));

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("./variable-form-fields", () => ({
  VariableFormFields: ({
    mode,
    submitLabel,
  }: {
    mode: "create" | "edit";
    submitLabel: string;
  }) => (
    <div>
      <p>{mode === "create" ? "Create form" : "Edit form"}</p>
      <button type="submit">{submitLabel}</button>
    </div>
  ),
}));

vi.mock("@workspace/ui/components/tabs", async () => {
  const ReactModule = await import("react");
  const TabsContext = ReactModule.createContext<{
    value: string;
    onValueChange: (value: string) => void;
  }>({
    value: "",
    onValueChange: () => undefined,
  });

  return {
    Tabs: ({
      children,
      value,
      onValueChange,
    }: {
      children: React.ReactNode;
      value: string;
      onValueChange: (value: string) => void;
    }) => (
      <TabsContext.Provider value={{ value, onValueChange }}>
        <div>{children}</div>
      </TabsContext.Provider>
    ),
    TabsList: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    TabsTrigger: ({
      children,
      value,
    }: {
      children: React.ReactNode;
      value: string;
    }) => {
      const context = ReactModule.useContext(TabsContext);
      return (
        <button type="button" onClick={() => context.onValueChange(value)}>
          {children}
        </button>
      );
    },
    TabsContent: ({
      children,
      value,
    }: {
      children: React.ReactNode;
      value: string;
    }) => {
      const context = ReactModule.useContext(TabsContext);
      if (context.value !== value) {
        return null;
      }
      return <div>{children}</div>;
    },
  };
});

type VariableRow = VariablesPageResult["variables"][number];

const buildVariable = (): VariableRow => ({
  id: "00000000-0000-4000-8000-000000000001",
  key: "API_KEY",
  value: "masked",
  note: null,
  isSecret: true,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
  createdBy: null,
});

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

describe("VariableModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    usageMock.mockReset();
    refreshMock.mockReset();
  });

  it("renders create form without usage tab", () => {
    // Act
    render(<VariableModal variable={null} trigger={<button>Add</button>} />);

    // Assert
    expect(screen.getByText("Create form")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Used in pipelines" }),
    ).not.toBeInTheDocument();
  });

  it("shows loading then empty usage state in edit mode", async () => {
    // Setup
    const deferred = createDeferred<
      Array<{
        id: string;
        name: string;
        matchCount: number;
        matchedStepIds: string[];
      }>
    >();
    usageMock.mockReturnValueOnce(deferred.promise);

    // Act
    render(
      <VariableModal
        variable={buildVariable()}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Used in pipelines" }));

    // Assert
    expect(screen.getByText("Loading pipeline usage…")).toBeInTheDocument();

    // Act
    deferred.resolve([]);

    // Assert
    await waitFor(() => {
      expect(
        screen.getByText(
          "This variable is not referenced by any pipelines yet.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("renders linked pipeline usage rows when usage exists", async () => {
    // Setup
    usageMock.mockResolvedValueOnce([
      {
        id: "pipeline-1",
        name: "Pipeline One",
        matchCount: 2,
        matchedStepIds: ["step-1"],
      },
    ]);

    // Act
    render(
      <VariableModal
        variable={buildVariable()}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Used in pipelines" }));

    // Assert
    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: "Pipeline One" }),
      ).toHaveAttribute("href", "/dashboard/pipelines/pipeline-1");
    });
    expect(screen.getByText("2 matches")).toBeInTheDocument();
  });
});
