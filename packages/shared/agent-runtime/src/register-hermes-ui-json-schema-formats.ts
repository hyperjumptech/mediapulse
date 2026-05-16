/** JSON Schema `format` value used by {@link enrichConfigSchemaForHermesUi} for multiline prompt fields. */
export const HERMES_UI_TEXTAREA_FORMAT = "textarea";

type AjvFormatRegistrar = {
  addFormat: (
    name: string,
    format:
      | boolean
      | {
          type?: string;
          validate: (data: unknown) => boolean;
        },
  ) => unknown;
};

/**
 * Registers Hermes UI-only JSON Schema formats on an Ajv instance so schemas from
 * {@link enrichConfigSchemaForHermesUi} compile and validate (e.g. agent config save).
 *
 * @param ajv - Ajv instance (after `ajv-formats` when standard formats are needed).
 */
export const registerHermesUiJsonSchemaFormats = (
  ajv: AjvFormatRegistrar,
): void => {
  ajv.addFormat(HERMES_UI_TEXTAREA_FORMAT, {
    type: "string",
    validate: () => true,
  });
};
