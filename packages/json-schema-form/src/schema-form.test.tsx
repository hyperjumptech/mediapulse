/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { SchemaForm } from "./schema-form.js";
import type { JsonSchema } from "./types.js";

describe("SchemaForm", () => {
  it("renders nothing useful when schema is not object with properties", () => {
    // Setup
    const schema: JsonSchema = { type: "string" };
    const value: Record<string, unknown> = {};
    const onChange = vi.fn();

    // Act
    render(<SchemaForm schema={schema} value={value} onChange={onChange} />);

    // Assert
    expect(
      screen.getByText(/Schema must be an object with properties/i),
    ).toBeInTheDocument();
  });

  it("renders string field and calls onChange when user types", () => {
    // Setup
    const schema: JsonSchema = {
      type: "object",
      properties: {
        name: { type: "string", title: "Name" },
      },
    };
    const value: Record<string, unknown> = { name: "" };
    const onChange = vi.fn();

    // Act
    render(<SchemaForm schema={schema} value={value} onChange={onChange} />);
    const input = screen.getByLabelText(/Name/i);
    fireEvent.change(input, { target: { value: "test" } });

    // Assert
    expect(onChange).toHaveBeenCalledWith({ name: "test" });
  });

  it("renders number field and calls onChange with number", () => {
    // Setup
    const schema: JsonSchema = {
      type: "object",
      properties: {
        count: { type: "number", title: "Count" },
      },
    };
    const value: Record<string, unknown> = { count: 0 };
    const onChange = vi.fn();

    // Act
    render(<SchemaForm schema={schema} value={value} onChange={onChange} />);
    const input = screen.getByLabelText(/Count/i);
    fireEvent.change(input, { target: { value: "42" } });

    // Assert
    expect(onChange).toHaveBeenCalledWith({ count: 42 });
  });

  it("renders boolean field (checkbox) and calls onChange", () => {
    // Setup
    const schema: JsonSchema = {
      type: "object",
      properties: {
        enabled: { type: "boolean", title: "Enabled" },
      },
    };
    const value: Record<string, unknown> = { enabled: false };
    const onChange = vi.fn();

    // Act
    render(<SchemaForm schema={schema} value={value} onChange={onChange} />);
    const checkbox = screen.getByLabelText(/Enabled/i);
    fireEvent.click(checkbox);

    // Assert
    expect(onChange).toHaveBeenCalledWith({ enabled: true });
  });

  it("renders nested object fields", () => {
    // Setup
    const schema: JsonSchema = {
      type: "object",
      properties: {
        inner: {
          type: "object",
          title: "Inner",
          properties: {
            key: { type: "string", title: "Key" },
          },
        },
      },
    };
    const value: Record<string, unknown> = { inner: { key: "a" } };
    const onChange = vi.fn();

    // Act
    render(<SchemaForm schema={schema} value={value} onChange={onChange} />);
    const input = screen.getByLabelText(/Key/i);
    fireEvent.change(input, { target: { value: "b" } });

    // Assert
    expect(onChange).toHaveBeenCalledWith({ inner: { key: "b" } });
  });

  it("renders record (additionalProperties) with Add entry and key-value rows", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        providers: {
          type: "object",
          title: "Providers",
          additionalProperties: {
            type: "object",
            properties: {
              baseUrl: { type: "string", title: "Base URL" },
            },
          },
        },
      },
    };
    const value: Record<string, unknown> = { providers: {} };
    const onChange = vi.fn();

    render(<SchemaForm schema={schema} value={value} onChange={onChange} />);

    expect(
      screen.getByRole("button", { name: /add entry/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /add entry/i }));

    expect(onChange).toHaveBeenCalledWith({
      providers: { __new__: {} },
    });
    const withNew = { providers: { __new__: {} } };
    render(<SchemaForm schema={schema} value={withNew} onChange={onChange} />);
    expect(screen.getByPlaceholderText(/e.g. serper-dev/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/base url/i)).toBeInTheDocument();
  });

  it("seeds value with required keys when they are missing (so submission passes validation)", () => {
    // Setup: schema like data-collection agent (webSearch, webFetch required)
    const schema: JsonSchema = {
      type: "object",
      properties: {
        webSearch: { type: "object" },
        webFetch: { type: "object" },
      },
      required: ["webSearch", "webFetch"],
    };
    const value: Record<string, unknown> = {};
    const onChange = vi.fn();

    // Act
    render(<SchemaForm schema={schema} value={value} onChange={onChange} />);

    // Assert: effect should call onChange with seeded defaults
    expect(onChange).toHaveBeenCalledWith({
      webSearch: {},
      webFetch: {},
    });
  });

  it("calls validate on blur when validate prop is provided", () => {
    // Setup
    const schema: JsonSchema = {
      type: "object",
      properties: {
        name: { type: "string", title: "Name" },
      },
    };
    const value: Record<string, unknown> = { name: "" };
    const onChange = vi.fn();
    const validate = vi.fn().mockReturnValue({
      valid: false,
      errors: ["Name is required"],
    });

    // Act
    render(
      <SchemaForm
        schema={schema}
        value={value}
        onChange={onChange}
        validate={validate}
      />,
    );
    const input = screen.getByLabelText(/Name/i);
    fireEvent.blur(input);

    // Assert
    expect(validate).toHaveBeenCalledWith(value);
    expect(screen.getByText(/Name is required/i)).toBeInTheDocument();
  });
});
