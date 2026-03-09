import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  JsonSchemaSummary,
  isSchemaObject,
  getSchemaType,
  getRequiredProperties,
  getProperties,
  getPropertyTypeLabel,
} from "./json-schema-summary";

describe("isSchemaObject", () => {
  it("returns false for null and undefined", () => {
    expect(isSchemaObject(null)).toBe(false);
    expect(isSchemaObject(undefined)).toBe(false);
  });

  it("returns false for array and primitives", () => {
    expect(isSchemaObject([])).toBe(false);
    expect(isSchemaObject("x")).toBe(false);
    expect(isSchemaObject(1)).toBe(false);
  });

  it("returns true for plain object", () => {
    expect(isSchemaObject({})).toBe(true);
    expect(isSchemaObject({ type: "object" })).toBe(true);
  });
});

describe("getSchemaType", () => {
  it("returns type string when present", () => {
    expect(getSchemaType({ type: "object" })).toBe("object");
    expect(getSchemaType({ type: "string" })).toBe("string");
  });

  it("returns joined string for type array", () => {
    expect(getSchemaType({ type: ["string", "null"] })).toBe("string | null");
  });

  it("returns object when type missing", () => {
    expect(getSchemaType({})).toBe("object");
  });
});

describe("getRequiredProperties", () => {
  it("returns empty array when required missing", () => {
    expect(getRequiredProperties({})).toEqual([]);
  });

  it("returns required array when present", () => {
    expect(getRequiredProperties({ required: ["a", "b"] })).toEqual(["a", "b"]);
  });

  it("filters non-strings from required", () => {
    expect(getRequiredProperties({ required: ["a", 1, null] })).toEqual(["a"]);
  });
});

describe("getProperties", () => {
  it("returns empty object when properties missing", () => {
    expect(getProperties({})).toEqual({});
  });

  it("returns properties when present", () => {
    const props = { name: { type: "string" }, count: { type: "number" } };
    expect(getProperties({ properties: props })).toEqual(props);
  });
});

describe("getPropertyTypeLabel", () => {
  it("returns type string from property schema", () => {
    expect(getPropertyTypeLabel({ type: "string" })).toBe("string");
    expect(getPropertyTypeLabel({ type: "number" })).toBe("number");
  });

  it("returns object (N properties) for nested object", () => {
    expect(
      getPropertyTypeLabel({ properties: { a: { type: "string" }, b: {} } }),
    ).toBe("object (2 properties)");
  });
});

describe("JsonSchemaSummary", () => {
  it("renders No schema when schema is null", () => {
    render(<JsonSchemaSummary schema={null} />);
    expect(screen.getByTestId("schema-summary-empty")).toHaveTextContent(
      "No schema",
    );
  });

  it("renders No schema when schema is undefined", () => {
    render(<JsonSchemaSummary schema={undefined} />);
    expect(screen.getByTestId("schema-summary-empty")).toHaveTextContent(
      "No schema",
    );
  });

  it("renders Invalid schema when schema is not an object", () => {
    render(<JsonSchemaSummary schema="not an object" />);
    expect(screen.getByTestId("schema-summary-invalid")).toHaveTextContent(
      "Invalid schema",
    );
  });

  it("renders title when provided", () => {
    render(<JsonSchemaSummary schema={null} title="Input schema" />);
    expect(screen.getByText("Input schema")).toBeInTheDocument();
    expect(screen.getByText("No schema")).toBeInTheDocument();
  });

  it("renders type and properties table for valid schema", () => {
    render(
      <JsonSchemaSummary
        schema={{
          type: "object",
          required: ["query"],
          properties: {
            query: { type: "string" },
            limit: { type: "number" },
          },
        }}
        title="Input schema"
      />,
    );
    expect(screen.getByTestId("schema-summary")).toBeInTheDocument();
    expect(screen.getByText("Input schema")).toBeInTheDocument();
    expect(screen.getByText("object")).toBeInTheDocument();
    expect(screen.getAllByText("query").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("limit")).toBeInTheDocument();
    expect(screen.getByText("string")).toBeInTheDocument();
    expect(screen.getByText("number")).toBeInTheDocument();
    expect(screen.getAllByText("required").length).toBeGreaterThanOrEqual(1);
  });

  it("shows No properties when schema has no properties", () => {
    render(
      <JsonSchemaSummary schema={{ type: "object" }} title="Config schema" />,
    );
    expect(screen.getByTestId("schema-no-properties")).toHaveTextContent(
      "No properties",
    );
    expect(screen.getByText("Config schema")).toBeInTheDocument();
    expect(screen.getByText("object")).toBeInTheDocument();
  });

  it("shows No properties when schema has empty properties object", () => {
    render(
      <JsonSchemaSummary
        schema={{ type: "object", properties: {} }}
        title="Config schema"
      />,
    );
    expect(screen.getByTestId("schema-no-properties")).toHaveTextContent(
      "No properties",
    );
  });
});
