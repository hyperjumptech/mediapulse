const DEFAULT_ENV_PATHS = ["@hermes/env", "@mediapulse/env"];

/**
 * @param {unknown} source
 * @param {string[]} envPaths
 */
function isAllowedEnvImport(source, envPaths) {
  return typeof source === "string" && envPaths.includes(source);
}

export const noProcessEnv = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow the use of process.env",
      category: "Best Practices",
      recommended: true,
    },
    messages: {
      noProcessEnv:
        "Direct access to process.env is not allowed. Use env.{{envVar}} from `{{envPathLabel}}` instead.",
    },
    schema: [
      {
        type: "object",
        properties: {
          envPath: {
            type: "string",
            description:
              "Single allowed import path (legacy). Prefer envPaths for multiple packages.",
          },
          envPaths: {
            type: "array",
            items: { type: "string" },
            description:
              "Allowed import paths for typed env (e.g. @hermes/env, @mediapulse/env).",
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: "code",
  },
  create(context) {
    const options = context.options[0] || {};
    /** @type {string[]} */
    const envPaths =
      Array.isArray(options.envPaths) && options.envPaths.length > 0
        ? options.envPaths
        : options.envPath
          ? [options.envPath]
          : DEFAULT_ENV_PATHS;
    const envPathLabel = envPaths.join("`, `");
    const canAutoAddImport = envPaths.length === 1;
    const singleImportPath = envPaths[0];

    return {
      MemberExpression(node) {
        if (
          node.object.type === "Identifier" &&
          node.object.name === "process" &&
          node.property.type === "Identifier" &&
          node.property.name === "env"
        ) {
          const parent = node.parent;
          let envVarName = null;

          if (parent.type === "MemberExpression" && parent.property) {
            envVarName = parent.property.name || parent.property.value;
          }

          context.report({
            node,
            messageId: "noProcessEnv",
            data: {
              envVar: envVarName || "<ENV_VAR>",
              envPathLabel,
            },
            fix(fixer) {
              if (parent.type !== "MemberExpression") return null;

              const sourceCode = context.getSourceCode();
              const text = sourceCode.getText(parent);
              const replacement = text.replace(/process\.env\./, "env.");
              const program = sourceCode.ast;

              const hasEnvImport = program.body.some(
                (statement) =>
                  statement.type === "ImportDeclaration" &&
                  typeof statement.source.value === "string" &&
                  isAllowedEnvImport(statement.source.value, envPaths) &&
                  statement.specifiers.some(
                    (spec) =>
                      spec.type === "ImportSpecifier" &&
                      spec.imported.name === "env",
                  ),
              );

              if (hasEnvImport) {
                return fixer.replaceText(parent, replacement);
              }
              if (!canAutoAddImport || !singleImportPath) {
                return null;
              }

              const fixes = [];
              const lastImport = program.body
                .filter((n) => n.type === "ImportDeclaration")
                .pop();

              const importStatement = `import { env } from '${singleImportPath}';\n`;

              if (lastImport) {
                fixes.push(
                  fixer.insertTextAfter(lastImport, "\n" + importStatement),
                );
              } else {
                fixes.push(
                  fixer.insertTextBeforeRange([0, 0], importStatement + "\n"),
                );
              }

              fixes.push(fixer.replaceText(parent, replacement));
              return fixes;
            },
          });
        }
      },
    };
  },
};
