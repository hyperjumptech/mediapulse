/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  formDataToDomainPayload,
  getDomainTableFieldEditDefault,
  isoLikeToDatetimeLocalValue,
  parseDomainTableFormFieldsFromJsonSchema,
  parseJsonObjectRow,
  type DomainTableFormField,
} from "./domain-table-form-schema";

describe("parseDomainTableFormFieldsFromJsonSchema", () => {
  it("returns empty array for non-object or missing properties", () => {
    expect(parseDomainTableFormFieldsFromJsonSchema(null)).toEqual([]);
    expect(parseDomainTableFormFieldsFromJsonSchema(undefined)).toEqual([]);
    expect(parseDomainTableFormFieldsFromJsonSchema("x")).toEqual([]);
    expect(parseDomainTableFormFieldsFromJsonSchema({})).toEqual([]);
    expect(
      parseDomainTableFormFieldsFromJsonSchema({ properties: null }),
    ).toEqual([]);
  });

  it("parses string, number, integer, boolean, enum, and uses title labels", () => {
    const fields = parseDomainTableFormFieldsFromJsonSchema({
      type: "object",
      required: ["a", "b"],
      properties: {
        a: { type: "string", title: "Alpha" },
        b: { type: "integer" },
        c: { type: "number", title: "C" },
        d: { type: "boolean", title: "Flag" },
        e: { type: "string", format: "date-time" },
        f: { type: "string", format: "textarea" },
        g: { enum: ["x", "y"] },
      },
    });

    expect(fields).toHaveLength(7);
    expect(fields[0]).toMatchObject({
      kind: "string",
      key: "a",
      label: "Alpha",
      required: true,
      nullable: false,
    });
    expect(fields[1]).toMatchObject({
      kind: "number",
      key: "b",
      required: true,
      integer: true,
    });
    expect(fields[2]).toMatchObject({ kind: "number", integer: false });
    expect(fields[3]).toMatchObject({ kind: "boolean", key: "d" });
    expect(fields[4]).toMatchObject({ kind: "string", format: "date-time" });
    expect(fields[5]).toMatchObject({ kind: "string", format: "textarea" });
    expect(fields[6]).toMatchObject({
      kind: "enum",
      options: ["x", "y"],
    });
  });

  it("detects nullable via nullable, anyOf, and type array", () => {
    const nullableFlag = parseDomainTableFormFieldsFromJsonSchema({
      properties: {
        a: { type: "string", nullable: true },
      },
    });
    expect(nullableFlag[0]).toMatchObject({ nullable: true });

    const anyOfNull = parseDomainTableFormFieldsFromJsonSchema({
      properties: {
        a: {
          anyOf: [{ type: "string" }, { type: "null" }],
        },
      },
    });
    expect(anyOfNull[0]).toMatchObject({ kind: "string", nullable: true });

    const typeUnion = parseDomainTableFormFieldsFromJsonSchema({
      properties: {
        a: { type: ["string", "null"] },
      },
    });
    expect(typeUnion[0]).toMatchObject({ kind: "string", nullable: true });
  });

  it("merges anyOf non-null branch for type and enum", () => {
    const fields = parseDomainTableFormFieldsFromJsonSchema({
      properties: {
        a: {
          anyOf: [{ type: "string", enum: ["p", "q"] }, { type: "null" }],
        },
      },
    });
    expect(fields[0]).toMatchObject({
      kind: "enum",
      nullable: true,
      options: ["p", "q"],
    });
  });

  it("merges anyOf when the first branch is a plain string schema", () => {
    const fields = parseDomainTableFormFieldsFromJsonSchema({
      properties: {
        a: {
          anyOf: [{ type: "string", title: "Merged" }, { type: "null" }],
        },
      },
    });
    expect(fields[0]).toMatchObject({
      kind: "string",
      label: "Merged",
      nullable: true,
    });
  });

  it("merges type array with only null last", () => {
    const fields = parseDomainTableFormFieldsFromJsonSchema({
      properties: {
        a: { type: ["number", "null"], title: "N" },
      },
    });
    expect(fields[0]).toMatchObject({
      kind: "number",
      nullable: true,
      label: "N",
    });
  });

  it("skips non-object property entries", () => {
    const fields = parseDomainTableFormFieldsFromJsonSchema({
      properties: {
        a: "bad",
        b: null,
      },
    });
    expect(fields).toEqual([]);
  });

  it("falls back to string when type is unknown", () => {
    const fields = parseDomainTableFormFieldsFromJsonSchema({
      properties: {
        a: { title: "Only title" },
      },
    });
    expect(fields[0]).toMatchObject({
      kind: "string",
      key: "a",
      label: "Only title",
    });
  });

  it("ignores enum array with non-string entries", () => {
    const fields = parseDomainTableFormFieldsFromJsonSchema({
      properties: {
        a: { enum: [1, 2] },
      },
    });
    expect(fields[0]).toMatchObject({ kind: "string" });
  });

  it("parses object type with nested properties", () => {
    const fields = parseDomainTableFormFieldsFromJsonSchema({
      properties: {
        meta: {
          type: "object",
          title: "Metadata",
          nullable: true,
          properties: {
            Sektor: { type: "string", title: "Sektor" },
            flag: { type: "boolean", title: "Flag" },
          },
        },
      },
    });
    const first = fields[0];
    expect(first).toMatchObject({
      kind: "object",
      key: "meta",
      label: "Metadata",
      nullable: true,
    });
    expect(first?.kind).toBe("object");
    if (first?.kind === "object") {
      expect(first.properties).toHaveLength(2);
      expect(first.properties[0]).toMatchObject({
        kind: "string",
        key: "Sektor",
      });
    }
  });

  it("falls back to textarea when object has no properties", () => {
    const fields = parseDomainTableFormFieldsFromJsonSchema({
      properties: {
        meta: { type: "object", title: "Raw JSON" },
      },
    });
    expect(fields[0]).toMatchObject({
      kind: "string",
      format: "textarea",
      key: "meta",
    });
  });
});

describe("formDataToDomainPayload", () => {
  const makeFields = (): DomainTableFormField[] => [
    { kind: "string", key: "s", label: "S", required: true, nullable: false },
    {
      kind: "string",
      key: "sOpt",
      label: "So",
      required: false,
      nullable: false,
    },
    {
      kind: "string",
      key: "sNull",
      label: "Sn",
      required: false,
      nullable: true,
    },
    { kind: "boolean", key: "b", label: "B", required: true },
    {
      kind: "number",
      key: "nReq",
      label: "N",
      required: true,
      nullable: false,
      integer: false,
    },
    {
      kind: "number",
      key: "nOpt",
      label: "No",
      required: false,
      nullable: false,
      integer: true,
    },
    {
      kind: "number",
      key: "nNull",
      label: "Nn",
      required: false,
      nullable: true,
      integer: false,
    },
    {
      kind: "enum",
      key: "eReq",
      label: "E",
      required: true,
      nullable: false,
      options: ["a", "b"],
    },
    {
      kind: "enum",
      key: "eNull",
      label: "En",
      required: false,
      nullable: true,
      options: ["a"],
    },
  ];

  it("coerces booleans and omits optional empty strings", () => {
    const fd = new FormData();
    fd.set("s", "  hi  ");
    fd.set("sOpt", "");
    fd.set("b", "true");
    fd.set("nReq", "2.5");
    fd.set("nOpt", "");
    fd.set("nNull", "");
    fd.set("eReq", "b");
    fd.set("eNull", "");

    const payload = formDataToDomainPayload(fd, makeFields());

    expect(payload.s).toBe("hi");
    expect(payload.sOpt).toBeUndefined();
    expect(payload.sNull).toBeNull();
    expect(payload.b).toBe(true);
    expect(payload.nReq).toBe(2.5);
    expect(payload.nOpt).toBeUndefined();
    expect(payload.nNull).toBeNull();
    expect(payload.eReq).toBe("b");
    expect(payload.eNull).toBeNull();
  });

  it("treats missing boolean as false", () => {
    const fd = new FormData();
    fd.set("s", "x");
    fd.set("nReq", "1");
    fd.set("eReq", "a");
    const fields: DomainTableFormField[] = [
      { kind: "string", key: "s", label: "", required: true, nullable: false },
      { kind: "boolean", key: "b", label: "", required: true },
      {
        kind: "number",
        key: "nReq",
        label: "",
        required: true,
        nullable: false,
        integer: false,
      },
      {
        kind: "enum",
        key: "eReq",
        label: "",
        required: true,
        nullable: false,
        options: ["a", "b"],
      },
    ];
    const payload = formDataToDomainPayload(fd, fields);
    expect(payload.b).toBe(false);
  });

  it("handles number NaN and required defaults", () => {
    const fields: DomainTableFormField[] = [
      {
        kind: "number",
        key: "n",
        label: "",
        required: true,
        nullable: false,
        integer: true,
      },
    ];
    const fd = new FormData();
    fd.set("n", "not-a-number");
    expect(formDataToDomainPayload(fd, fields).n).toBe(0);
  });

  it("uses first enum option when required enum is empty", () => {
    const fields: DomainTableFormField[] = [
      {
        kind: "enum",
        key: "e",
        label: "",
        required: true,
        nullable: false,
        options: ["first", "second"],
      },
    ];
    const fd = new FormData();
    fd.set("e", "");
    expect(formDataToDomainPayload(fd, fields).e).toBe("first");
  });

  it("omits optional enum when empty and not nullable", () => {
    const fields: DomainTableFormField[] = [
      {
        kind: "enum",
        key: "e",
        label: "",
        required: false,
        nullable: false,
        options: ["a", "b"],
      },
    ];
    const fd = new FormData();
    fd.set("e", "");
    expect(formDataToDomainPayload(fd, fields).e).toBeUndefined();
  });

  it("coerces optional invalid number to null when nullable", () => {
    const fields: DomainTableFormField[] = [
      {
        kind: "number",
        key: "n",
        label: "",
        required: false,
        nullable: true,
        integer: false,
      },
    ];
    const fd = new FormData();
    fd.set("n", "not-a-number");
    expect(formDataToDomainPayload(fd, fields).n).toBeNull();
  });

  it("omits optional invalid number when not nullable", () => {
    const fields: DomainTableFormField[] = [
      {
        kind: "number",
        key: "n",
        label: "",
        required: false,
        nullable: false,
        integer: false,
      },
    ];
    const fd = new FormData();
    fd.set("n", "not-a-number");
    expect(formDataToDomainPayload(fd, fields).n).toBeUndefined();
  });

  it("includes empty string for required string field", () => {
    const fields: DomainTableFormField[] = [
      {
        kind: "string",
        key: "s",
        label: "",
        required: true,
        nullable: false,
      },
    ];
    const fd = new FormData();
    fd.set("s", "");
    expect(formDataToDomainPayload(fd, fields).s).toBe("");
  });

  it("defaults required empty number to zero", () => {
    const fields: DomainTableFormField[] = [
      {
        kind: "number",
        key: "n",
        label: "",
        required: true,
        nullable: false,
        integer: true,
      },
    ];
    const fd = new FormData();
    fd.set("n", "");
    expect(formDataToDomainPayload(fd, fields).n).toBe(0);
  });

  it("truncates integer fields toward zero", () => {
    const fields: DomainTableFormField[] = [
      {
        kind: "number",
        key: "n",
        label: "",
        required: true,
        nullable: false,
        integer: true,
      },
    ];
    const fd = new FormData();
    fd.set("n", "9.7");
    expect(formDataToDomainPayload(fd, fields).n).toBe(9);
  });

  it("builds nested object payload from dot-named form fields", () => {
    const fields: DomainTableFormField[] = [
      {
        kind: "object",
        key: "metadata",
        label: "Metadata",
        required: false,
        nullable: true,
        properties: [
          {
            kind: "string",
            key: "Sektor",
            label: "Sektor",
            required: false,
            nullable: true,
          },
          { kind: "boolean", key: "flag", label: "Flag", required: true },
        ],
      },
    ];
    const fd = new FormData();
    fd.set("metadata.Sektor", "Finance");
    fd.set("metadata.flag", "true");
    expect(formDataToDomainPayload(fd, fields)).toEqual({
      metadata: { Sektor: "Finance", flag: true },
    });
  });
});

describe("parseJsonObjectRow", () => {
  it("parses JSON strings and objects", () => {
    expect(parseJsonObjectRow(null)).toEqual({});
    expect(parseJsonObjectRow('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonObjectRow({ b: 2 })).toEqual({ b: 2 });
  });
});

describe("getDomainTableFieldEditDefault", () => {
  const row = {
    str: "hello",
    empty: null,
    num: 3.25,
    flag: false,
    choice: "a",
    iso: "2024-06-01T12:30:00.000Z",
  };

  it("returns defaults for each field kind", () => {
    expect(
      getDomainTableFieldEditDefault(
        {
          kind: "string",
          key: "str",
          label: "",
          required: true,
          nullable: false,
        },
        row,
      ),
    ).toBe("hello");
    expect(
      getDomainTableFieldEditDefault(
        {
          kind: "string",
          key: "missing",
          label: "",
          required: false,
          nullable: true,
        },
        row,
      ),
    ).toBe("");
    expect(
      getDomainTableFieldEditDefault(
        {
          kind: "number",
          key: "num",
          label: "",
          required: true,
          nullable: false,
          integer: false,
        },
        row,
      ),
    ).toBe("3.25");
    expect(
      getDomainTableFieldEditDefault(
        {
          kind: "number",
          key: "numStr",
          label: "",
          required: true,
          nullable: false,
          integer: false,
        },
        { ...row, numStr: "9.5" },
      ),
    ).toBe("9.5");
    expect(
      getDomainTableFieldEditDefault(
        {
          kind: "number",
          key: "nan",
          label: "",
          required: true,
          nullable: false,
          integer: false,
        },
        { nan: Number.NaN },
      ),
    ).toBe("NaN");
    expect(
      getDomainTableFieldEditDefault(
        { kind: "boolean", key: "flag", label: "", required: true },
        row,
      ),
    ).toBe(false);
    expect(
      getDomainTableFieldEditDefault(
        {
          kind: "enum",
          key: "choice",
          label: "",
          required: true,
          nullable: false,
          options: ["a"],
        },
        row,
      ),
    ).toBe("a");
    expect(
      getDomainTableFieldEditDefault(
        {
          kind: "enum",
          key: "missingEnum",
          label: "",
          required: false,
          nullable: true,
          options: ["a"],
        },
        row,
      ),
    ).toBe("");
    expect(
      getDomainTableFieldEditDefault(
        {
          kind: "string",
          key: "iso",
          label: "",
          required: false,
          nullable: true,
          format: "date-time",
        },
        row,
      ),
    ).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    expect(
      getDomainTableFieldEditDefault(
        {
          kind: "object",
          key: "meta",
          label: "",
          required: false,
          nullable: true,
          properties: [],
        },
        row,
      ),
    ).toBe("");
  });
});

describe("isoLikeToDatetimeLocalValue", () => {
  it("returns empty for blank or invalid", () => {
    expect(isoLikeToDatetimeLocalValue("")).toBe("");
    expect(isoLikeToDatetimeLocalValue("   ")).toBe("");
    expect(isoLikeToDatetimeLocalValue("not-a-date")).toBe("");
  });

  it("formats a valid ISO string", () => {
    const v = isoLikeToDatetimeLocalValue("2024-06-01T12:30:00.000Z");
    expect(v).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
