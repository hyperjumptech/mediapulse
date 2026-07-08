import type Ajv from "ajv";

/** JSON Schema `format` value used by {@link enrichConfigSchemaForHermesUi} for multiline prompt fields. */
export const HERMES_UI_TEXTAREA_FORMAT = "textarea";

/** JSON Schema annotation keyword used by {@link enrichConfigSchemaForHermesUi} to record field order. */
export const HERMES_UI_PROPERTY_ORDER_KEYWORD = "propertyOrder";

/**
 * Registers Hermes UI-only JSON Schema extensions on an Ajv instance so schemas from
 * {@link enrichConfigSchemaForHermesUi} compile and validate (e.g. agent config save):
 * the `textarea` format and the `propertyOrder` annotation keyword (no-op for validation).
 *
 * @param ajv - Ajv instance (after `ajv-formats` when standard formats are needed).
 */
export const registerHermesUiJsonSchemaFormats = (
  ajv: Pick<Ajv, "addFormat" | "addKeyword">,
): void => {
  ajv.addFormat(HERMES_UI_TEXTAREA_FORMAT, {
    type: "string",
    validate: () => true,
  });
  ajv.addKeyword({ keyword: HERMES_UI_PROPERTY_ORDER_KEYWORD });
};
