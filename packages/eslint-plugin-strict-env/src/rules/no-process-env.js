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
        "Direct access to process.env is not allowed. Use env.{{envVar}} from `{{envPath}}` instead.",
    },
    schema: [
      {
        type: "object",
        properties: {
          envPath: {
            type: "string",
            default: "@workspace/env",
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: "code",
  },
  create(context) {
    const options = context.options[0] || {};
    const envPath = options.envPath || "@workspace/env";

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
              envPath: envPath,
            },
            fix(fixer) {
              if (envVarName && parent.type === "MemberExpression") {
                const sourceCode = context.getSourceCode();
                const text = sourceCode.getText(parent);
                const replacement = text.replace(/process\.env\./, "env.");
                const program = sourceCode.ast;

                const hasEnvImport = program.body.some(
                  (statement) =>
                    statement.type === "ImportDeclaration" &&
                    statement.source.value === envPath &&
                    statement.specifiers.some(
                      (spec) =>
                        spec.type === "ImportSpecifier" &&
                        spec.imported.name === "env"
                    )
                );

                if (hasEnvImport) {
                  return fixer.replaceText(parent, replacement);
                } else {
                  const fixes = [];
                  const lastImport = program.body
                    .filter((node) => node.type === "ImportDeclaration")
                    .pop();

                  const importStatement = `import { env } from '${envPath}';\n`;

                  if (lastImport) {
                    fixes.push(
                      fixer.insertTextAfter(lastImport, "\n" + importStatement)
                    );
                  } else {
                    fixes.push(
                      fixer.insertTextBeforeRange(
                        [0, 0],
                        importStatement + "\n"
                      )
                    );
                  }

                  fixes.push(fixer.replaceText(parent, replacement));
                  return fixes;
                }
              }
              return null;
            },
          });
        }
      },
    };
  },
};
