import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import {
  VariableExpansionInput,
  insertAtRange,
} from "./variable-expansion-input";

vi.mock("@workspace/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dropdown-trigger">{children}</div>
  ),
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onSelect,
    disabled,
  }: React.PropsWithChildren<{
    onSelect?: (e: { preventDefault: () => void }) => void;
    disabled?: boolean;
  }>) => (
    <button
      type="button"
      data-testid="dropdown-item"
      data-disabled={disabled}
      onClick={() => onSelect?.({ preventDefault: () => {} })}
    >
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr data-testid="dropdown-separator" />,
}));

describe("insertAtRange", () => {
  it("inserts at start when start and end are 0", () => {
    // Act
    const result = insertAtRange("hello", 0, 0, "{{X}}");

    // Assert
    expect(result).toBe("{{X}}hello");
  });

  it("inserts at cursor in middle", () => {
    // Act
    const result = insertAtRange("hello", 2, 2, "{{Y}}");

    // Assert
    expect(result).toBe("he{{Y}}llo");
  });

  it("replaces selection when start < end", () => {
    // Act
    const result = insertAtRange("hello", 1, 4, "{{Z}}");

    // Assert
    expect(result).toBe("h{{Z}}o");
  });
});

describe("VariableExpansionInput", () => {
  it("renders input with value and label", () => {
    // Setup
    const onChange = vi.fn();

    // Act
    render(
      <VariableExpansionInput
        value="test"
        onChange={onChange}
        id="f1"
        label="My field"
        variables={[]}
        expansions={[]}
      />,
    );

    // Assert
    const input = screen.getByLabelText(/My field/i);
    expect(input).toHaveValue("test");
  });

  it("renders description when provided", () => {
    // Act
    render(
      <VariableExpansionInput
        value=""
        onChange={() => {}}
        id="f2"
        label="F"
        description="Help text"
        variables={[]}
        expansions={[]}
      />,
    );

    // Assert
    expect(screen.getByText("Help text")).toBeInTheDocument();
  });

  it("does not show Insert button when variables and expansions are empty", () => {
    // Act
    render(
      <VariableExpansionInput
        value=""
        onChange={() => {}}
        variables={[]}
        expansions={[]}
      />,
    );

    // Assert
    expect(
      screen.queryByRole("button", { name: /insert/i }),
    ).not.toBeInTheDocument();
  });

  it("shows Insert button when variables are provided", () => {
    // Act
    render(
      <VariableExpansionInput
        value=""
        onChange={() => {}}
        variables={[{ key: "API_KEY" }]}
        expansions={[]}
      />,
    );

    // Assert
    expect(
      screen.getByRole("button", { name: /insert variable or expansion/i }),
    ).toBeInTheDocument();
  });

  it("shows Insert button when expansions are provided", () => {
    // Act
    render(
      <VariableExpansionInput
        value=""
        onChange={() => {}}
        variables={[]}
        expansions={[
          { id: "e1", name: "Tickers", expansionString: "db:ticker:id" },
        ]}
      />,
    );

    // Assert
    expect(
      screen.getByRole("button", { name: /insert variable or expansion/i }),
    ).toBeInTheDocument();
  });

  it("calls onChange when user types", () => {
    // Setup
    const onChange = vi.fn();

    // Act
    render(
      <VariableExpansionInput
        value=""
        onChange={onChange}
        variables={[]}
        expansions={[]}
      />,
    );
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "typed" } });

    // Assert
    expect(onChange).toHaveBeenCalledWith("typed");
  });

  it("inserts variable placeholder when variable item is selected", () => {
    // Setup
    const onChange = vi.fn();

    // Act
    render(
      <VariableExpansionInput
        value="hello"
        onChange={onChange}
        variables={[{ key: "SECRET" }]}
        expansions={[]}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /insert variable or expansion/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "SECRET" }));

    // Assert
    expect(onChange).toHaveBeenCalledWith(
      expect.stringContaining("{{SECRET}}"),
    );
  });

  it("inserts expansion string when expansion item is selected", () => {
    // Setup
    const onChange = vi.fn();
    const expansionString = "db:ticker:id?take=10";

    // Act
    render(
      <VariableExpansionInput
        value=""
        onChange={onChange}
        variables={[]}
        expansions={[{ id: "e1", name: "Tickers", expansionString }]}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /insert variable or expansion/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Tickers" }));

    // Assert
    expect(onChange).toHaveBeenCalledWith(expansionString);
  });

  it("disables input and Insert button when disabled is true", () => {
    // Act
    render(
      <VariableExpansionInput
        value="x"
        onChange={() => {}}
        disabled={true}
        variables={[{ key: "K" }]}
        expansions={[]}
      />,
    );

    // Assert
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /insert variable or expansion/i }),
    ).toBeDisabled();
  });
});
