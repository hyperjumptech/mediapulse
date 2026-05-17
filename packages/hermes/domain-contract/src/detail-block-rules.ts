/**
 * Tiny declarative expression language for detail-block section-header rules.
 *
 * Supported expression forms (whitespace-tolerant):
 *
 * - `<path> < <number>` / `<=` / `>` / `>=` — numeric comparison.
 * - `<path> == <value>` / `!=` — equality (numbers, strings in double quotes, true/false/null).
 * - `<path> < <path>` and other comparisons — path-to-path numeric comparison.
 * - `<path>.length == 0` (etc.) — numeric comparison on array length.
 * - `present(<path>)` — true when value at path is not null/undefined.
 * - `absent(<path>)` — true when value at path is null/undefined.
 * - `hoursBetween(<path>, <path>) > <number>` — absolute hours between two ISO-8601 strings.
 *
 * Anything else is rejected at parse time so the language stays declarative
 * (no `&&`, `||`, function calls beyond the three above, no arithmetic).
 */

/** Parsed AST for a single detail-block rule expression. */
export type DetailBlockRuleAst =
  | {
      kind: "compare";
      operator: "<" | "<=" | ">" | ">=" | "==" | "!=";
      left: DetailBlockRuleOperand;
      right: DetailBlockRuleOperand;
    }
  | { kind: "present"; path: string }
  | { kind: "absent"; path: string };

type DetailBlockRuleOperand =
  | { kind: "path"; path: string }
  | { kind: "literal-number"; value: number }
  | { kind: "literal-string"; value: string }
  | { kind: "literal-boolean"; value: boolean }
  | { kind: "literal-null" }
  | { kind: "length"; path: string }
  | { kind: "hoursBetween"; pathA: string; pathB: string };

const COMPARE_OPERATORS = ["<=", ">=", "==", "!=", "<", ">"] as const;

const VALID_PATH_REGEX = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*$/;

/**
 * Parses a rule expression into an AST. Throws when the expression uses
 * unsupported syntax (e.g. boolean operators or unknown function names).
 *
 * @param expression - Source string from a manifest section rule.
 * @returns Parsed AST node.
 */
export function parseDetailBlockRule(expression: string): DetailBlockRuleAst {
  const trimmed = expression.trim();
  if (trimmed.length === 0) {
    throw new Error("Empty rule expression");
  }

  if (trimmed.includes("&&") || trimmed.includes("||")) {
    throw new Error(
      "Boolean operators (&&, ||) are not supported in detail-block rules",
    );
  }

  const presentMatch = /^present\(\s*([^\s)]+)\s*\)$/.exec(trimmed);
  if (presentMatch) {
    const path = presentMatch[1] ?? "";
    assertValidPath(path);
    return { kind: "present", path };
  }
  const absentMatch = /^absent\(\s*([^\s)]+)\s*\)$/.exec(trimmed);
  if (absentMatch) {
    const path = absentMatch[1] ?? "";
    assertValidPath(path);
    return { kind: "absent", path };
  }

  for (const operator of COMPARE_OPERATORS) {
    const index = findTopLevelOperator(trimmed, operator);
    if (index === -1) continue;
    const leftRaw = trimmed.slice(0, index).trim();
    const rightRaw = trimmed.slice(index + operator.length).trim();
    if (leftRaw.length === 0 || rightRaw.length === 0) {
      throw new Error(`Invalid rule expression: "${expression}"`);
    }
    return {
      kind: "compare",
      operator,
      left: parseOperand(leftRaw),
      right: parseOperand(rightRaw),
    };
  }

  throw new Error(`Unsupported rule expression: "${expression}"`);
}

const findTopLevelOperator = (source: string, operator: string): number => {
  let depth = 0;
  let inString = false;
  for (let i = 0; i <= source.length - operator.length; i++) {
    const ch = source[i];
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    if (depth === 0 && source.startsWith(operator, i)) {
      return i;
    }
  }
  return -1;
};

const parseOperand = (raw: string): DetailBlockRuleOperand => {
  if (raw === "true") return { kind: "literal-boolean", value: true };
  if (raw === "false") return { kind: "literal-boolean", value: false };
  if (raw === "null") return { kind: "literal-null" };

  if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) {
    return { kind: "literal-string", value: raw.slice(1, -1) };
  }

  if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
    return { kind: "literal-number", value: Number.parseFloat(raw) };
  }

  const hoursBetween = /^hoursBetween\(\s*([^,\s]+)\s*,\s*([^)\s]+)\s*\)$/.exec(
    raw,
  );
  if (hoursBetween) {
    const a = hoursBetween[1] ?? "";
    const b = hoursBetween[2] ?? "";
    assertValidPath(a);
    assertValidPath(b);
    return { kind: "hoursBetween", pathA: a, pathB: b };
  }

  const lengthMatch = /^([A-Za-z_][\w.]*)\.length$/.exec(raw);
  if (lengthMatch) {
    const path = lengthMatch[1] ?? "";
    assertValidPath(path);
    return { kind: "length", path };
  }

  if (raw.includes("(")) {
    throw new Error(`Unsupported function call in rule operand: "${raw}"`);
  }

  assertValidPath(raw);
  return { kind: "path", path: raw };
};

const assertValidPath = (path: string): void => {
  if (!VALID_PATH_REGEX.test(path)) {
    throw new Error(`Invalid path in rule expression: "${path}"`);
  }
};

/**
 * Evaluates a parsed rule against a JSON-shaped value and returns a boolean.
 * Returns false when any operand value is missing rather than throwing,
 * so a missing field never crashes the renderer.
 *
 * @param ast - Output from {@link parseDetailBlockRule}.
 * @param data - Detail response object (or any nested object).
 * @returns Whether the rule matches.
 */
export function evaluateDetailBlockRule(
  ast: DetailBlockRuleAst,
  data: unknown,
): boolean {
  if (ast.kind === "present") {
    const value = resolvePath(data, ast.path);
    return value !== undefined && value !== null;
  }
  if (ast.kind === "absent") {
    const value = resolvePath(data, ast.path);
    return value === undefined || value === null;
  }
  const leftValue = resolveOperand(ast.left, data);
  const rightValue = resolveOperand(ast.right, data);
  if (leftValue === undefined || rightValue === undefined) {
    return false;
  }
  return compare(ast.operator, leftValue, rightValue);
}

const resolveOperand = (
  operand: DetailBlockRuleOperand,
  data: unknown,
): number | string | boolean | null | undefined => {
  switch (operand.kind) {
    case "path":
      return resolvePath(data, operand.path) as
        | number
        | string
        | boolean
        | null
        | undefined;
    case "literal-number":
      return operand.value;
    case "literal-string":
      return operand.value;
    case "literal-boolean":
      return operand.value;
    case "literal-null":
      return null;
    case "length": {
      const value = resolvePath(data, operand.path);
      if (Array.isArray(value)) return value.length;
      if (typeof value === "string") return value.length;
      return undefined;
    }
    case "hoursBetween": {
      const a = resolvePath(data, operand.pathA);
      const b = resolvePath(data, operand.pathB);
      const timeA = parseTimestamp(a);
      const timeB = parseTimestamp(b);
      if (timeA === undefined || timeB === undefined) return undefined;
      return Math.abs(timeA - timeB) / 36e5;
    }
  }
};

const parseTimestamp = (value: unknown): number | undefined => {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? undefined : time;
  }
  if (typeof value !== "string") return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const compare = (
  operator: "<" | "<=" | ">" | ">=" | "==" | "!=",
  left: number | string | boolean | null,
  right: number | string | boolean | null,
): boolean => {
  if (operator === "==") return left === right;
  if (operator === "!=") return left !== right;
  if (typeof left !== "number" || typeof right !== "number") {
    return false;
  }
  switch (operator) {
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    case ">":
      return left > right;
    case ">=":
      return left >= right;
  }
};

/**
 * Resolves a dotted path on a value. Returns `undefined` when any segment is
 * missing. Pure helper — no throwing on missing keys.
 *
 * @param value - Source data (typically the detail response object).
 * @param path - Dotted path like `activeQuerySet.generatedAt`.
 * @returns Resolved value or `undefined`.
 */
export function resolvePath(value: unknown, path: string): unknown {
  if (path.length === 0) return value;
  const segments = path.split(".");
  let current: unknown = value;
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Renders a URL template by substituting `{path}` placeholders with values
 * resolved from `data`. Missing values cause the function to return `undefined`
 * so the caller can fall back to plain text.
 *
 * @param template - URL template (e.g. `/dashboard/{integrationId}/tickers/{tickerId}`).
 * @param data - Object the placeholders resolve against.
 * @returns Rendered URL, or `undefined` when any placeholder is missing.
 */
export function renderUrlTemplate(
  template: string,
  data: unknown,
): string | undefined {
  let missing = false;
  const result = template.replace(/\{([^}]+)\}/g, (_match, raw: string) => {
    const path = raw.trim();
    const value = resolvePath(data, path);
    if (value === undefined || value === null || value === "") {
      missing = true;
      return "";
    }
    const stringValue = String(value);
    if (/^https?:\/\//i.test(stringValue)) {
      return stringValue;
    }
    return encodeURIComponent(stringValue);
  });
  if (missing) return undefined;
  return result;
}

/**
 * Renders a caption template (e.g. `Citations ({citations.length} unique)`).
 * Missing values render as an empty string and are left in place; the function
 * never returns `undefined` so captions degrade gracefully.
 *
 * @param template - Caption template with `{path}` or `{path.length}` placeholders.
 * @param data - Detail response.
 * @returns Rendered caption string.
 */
export function renderCaptionTemplate(template: string, data: unknown): string {
  return template.replace(/\{([^}]+)\}/g, (_match, raw: string) => {
    const path = raw.trim();
    if (path.endsWith(".length")) {
      const base = path.slice(0, -".length".length);
      const value = resolvePath(data, base);
      if (Array.isArray(value)) return String(value.length);
      if (typeof value === "string") return String(value.length);
      return "0";
    }
    const value = resolvePath(data, path);
    if (value === null || value === undefined) return "";
    return String(value);
  });
}
