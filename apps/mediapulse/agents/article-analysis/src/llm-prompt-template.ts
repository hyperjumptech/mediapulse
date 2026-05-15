/** Pattern source for `{{token}}` placeholders (token: letter + alphanumerics/underscore). */
const PLACEHOLDER_TOKEN_SOURCE = String.raw`\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}`;

/**
 * Lists unique placeholder token names found in `template` (without braces).
 *
 * @param template - Prompt string that may contain `{{name}}` tokens.
 * @returns Sorted unique token names.
 */
export const listLlmPromptPlaceholderNames = (template: string): string[] => {
  const re = new RegExp(PLACEHOLDER_TOKEN_SOURCE, "g");
  const found = new Set<string>();
  for (const match of template.matchAll(re)) {
    const name = match[1];
    if (name) {
      found.add(name);
    }
  }
  return [...found].sort();
};

/**
 * Returns placeholder names in `template` that are not in `allowed`.
 *
 * @param template - Prompt string to scan.
 * @param allowed - Set of permitted token names (without braces).
 * @returns Sorted unknown token names for error messages.
 */
export const findUnknownLlmPromptPlaceholderTokens = (
  template: string,
  allowed: ReadonlySet<string>,
): string[] =>
  listLlmPromptPlaceholderNames(template).filter((n) => !allowed.has(n));

/**
 * Replaces each `{{name}}` in `template` with `replacements[name]` when present.
 * Tokens with no replacement entry are left unchanged.
 *
 * @param template - Source template.
 * @param replacements - Map from token name to replacement string.
 * @returns Template after substitution.
 */
export const substituteLlmPromptTemplate = (
  template: string,
  replacements: Readonly<Record<string, string>>,
): string =>
  template.replace(new RegExp(PLACEHOLDER_TOKEN_SOURCE, "g"), (_full, name: string) =>
    Object.prototype.hasOwnProperty.call(replacements, name)
      ? replacements[name]!
      : `{{${name}}}`,
  );
