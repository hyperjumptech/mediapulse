# @workspace/json-schema-form

Renders a form from a JSON Schema. Supports nested objects and arrays. Used by Hermes for agent config forms and reusable in other apps.

## Usage

```tsx
import { SchemaForm } from "@workspace/json-schema-form";

const schema = {
  type: "object",
  properties: {
    name: { type: "string", title: "Name" },
    count: { type: "number", title: "Count" },
  },
};

<SchemaForm
  schema={schema}
  value={value}
  onChange={setValue}
  validate={optionalValidateFn}
/>;
```

## Supported schema types

- `string` (text input or select when `enum` is set)
- `number` / `integer`
- `boolean` (checkbox)
- `object` (nested; recurses into `properties`)
- `object` with `additionalProperties` only (record/dynamic keys: “Add entry” to add key-value pairs; each value uses the `additionalProperties` schema)
- `array` (with `items` schema; add/remove items)

`title` and `description` are used for labels and hints.

## Validation

Pass an optional `validate(value)` function. It is called on blur and errors are shown when it returns `{ valid: false, errors: string[] }`.
