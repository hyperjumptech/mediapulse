import { z } from "zod";

/**
 * Parses booleans from JSON clients (`true` / `false`) and from HTML forms, where
 * paired checkbox/hidden fields submit the strings `"true"` and `"false"`.
 *
 * **Do not use `z.coerce.boolean()` for form-encoded values:** in Zod 3,
 * `z.coerce.boolean().parse("false")` is `true` because string `"false"` is
 * coerced via truthiness, not lexical comparison.
 */
export const zFormBoolean = z.union([
  z.boolean(),
  z.literal("true").transform(() => true),
  z.literal("false").transform(() => false),
]);
