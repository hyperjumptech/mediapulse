import * as React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { VariableExpansionInput } from "./variable-expansion-input";

vi.mock("@workspace/ui/components/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
}));

vi.mock("@workspace/ui/components/tabs", () => {
  const TabsContext = React.createContext<{
    value: string;
    onValueChange: (v: string) => void;
  } | null>(null);

  const Tabs = ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (v: string) => void;
  }) => (
    <TabsContext.Provider value={{ value, onValueChange }}>
      {children}
    </TabsContext.Provider>
  );

  const TabsList = ({ children }: { children: React.ReactNode }) => (
    <div role="tablist">{children}</div>
  );

  const TabsTrigger = ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => {
    const ctx = React.useContext(TabsContext);
    return (
      <button
        type="button"
        role="tab"
        aria-selected={ctx?.value === value}
        onClick={() => ctx?.onValueChange(value)}
      >
        {children}
      </button>
    );
  };

  const TabsContent = ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => {
    const ctx = React.useContext(TabsContext);
    if (ctx?.value !== value) {
      return null;
    }
    return <div role="tabpanel">{children}</div>;
  };

  return { Tabs, TabsList, TabsTrigger, TabsContent };
});

const loadVariablesPage = vi.fn().mockResolvedValue({
  items: [{ key: "SECRET" }],
  total: 1,
});

const loadExpansionsPage = vi.fn().mockResolvedValue({
  items: [
    {
      id: "e1",
      name: "Tickers",
      expansionString: "db:ticker:id?take=10",
    },
  ],
  total: 1,
});

beforeEach(() => {
  vi.clearAllMocks();
  loadVariablesPage.mockResolvedValue({
    items: [{ key: "SECRET" }],
    total: 1,
  });
  loadExpansionsPage.mockResolvedValue({
    items: [
      {
        id: "e1",
        name: "Tickers",
        expansionString: "db:ticker:id?take=10",
      },
    ],
    total: 1,
  });
});

describe("VariableExpansionInput (integration)", () => {
  it("renders input with value and label", () => {
    const onChange = vi.fn();

    render(
      <VariableExpansionInput
        value="test"
        onChange={onChange}
        id="f1"
        label="My field"
        loadVariablesPage={loadVariablesPage}
        loadExpansionsPage={loadExpansionsPage}
      />,
    );

    expect(screen.getByLabelText(/My field/i)).toHaveValue("test");
  });

  it("opens modal and loads variables tab", async () => {
    const onChange = vi.fn();

    render(
      <VariableExpansionInput
        value=""
        onChange={onChange}
        loadVariablesPage={loadVariablesPage}
        loadExpansionsPage={loadExpansionsPage}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /insert variable or expansion/i }),
    );

    await waitFor(() => {
      expect(loadVariablesPage).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "SECRET" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "SECRET" }));

    expect(onChange).toHaveBeenCalledWith("{{SECRET}}");
  });

  it("inserts expansion from expansions tab", async () => {
    const onChange = vi.fn();

    render(
      <VariableExpansionInput
        value=""
        onChange={onChange}
        loadVariablesPage={loadVariablesPage}
        loadExpansionsPage={loadExpansionsPage}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /insert variable or expansion/i }),
    );

    fireEvent.click(screen.getByRole("tab", { name: /expansions/i }));

    await waitFor(() => {
      expect(loadExpansionsPage).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Tickers" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Tickers" }));

    expect(onChange).toHaveBeenCalledWith("db:ticker:id?take=10");
  });
});
