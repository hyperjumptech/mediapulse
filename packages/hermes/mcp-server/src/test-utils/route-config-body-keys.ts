import ts from "typescript";

export type RouteBodyKey = {
  name: string;
  optional: boolean;
};

export type RouteConfigContract = {
  userGuard: string;
  bodyKeys: RouteBodyKey[];
};

const OPTIONAL_MARKERS = new Set([
  "optional",
  "nullish",
  "default",
  "prefault",
  "catch",
]);

const PASSTHROUGH_OBJECT_METHODS = new Set([
  "refine",
  "superRefine",
  "strict",
  "strip",
  "passthrough",
  "check",
  "describe",
]);

const KNOWN_FIELD_HELPERS: Record<string, boolean> = {
  jsonObjectFieldSchema: false,
  optionalJsonObjectFieldSchema: true,
};

const ACCEPTS_UNDEFINED_SCHEMAS = new Set(["unknown", "any", "undefined"]);

type ModuleScope = {
  sourceFile: ts.SourceFile;
  constants: Map<string, ts.Expression>;
  filePath: string;
};

class UnresolvedRouteSchemaError extends Error {}

const unresolved = (scope: ModuleScope, node: ts.Node, reason: string) =>
  new UnresolvedRouteSchemaError(
    `${scope.filePath}: cannot resolve ${reason} at "${node.getText(scope.sourceFile).slice(0, 80)}". Extend route-config-body-keys.ts.`,
  );

const collectTopLevelConstants = (
  sourceFile: ts.SourceFile,
): Map<string, ts.Expression> => {
  const constants = new Map<string, ts.Expression>();
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) {
        constants.set(declaration.name.text, declaration.initializer);
      }
    }
  }

  return constants;
};

const unwrapExpression = (expression: ts.Expression): ts.Expression => {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }

  return current;
};

const isZodMember = (expression: ts.Expression, member: string): boolean =>
  ts.isPropertyAccessExpression(expression) &&
  ts.isIdentifier(expression.expression) &&
  expression.expression.text === "z" &&
  expression.name.text === member;

const zodFactoryName = (expression: ts.Expression): string | undefined =>
  ts.isPropertyAccessExpression(expression) &&
  ts.isIdentifier(expression.expression) &&
  expression.expression.text === "z"
    ? expression.name.text
    : undefined;

const propertyName = (scope: ModuleScope, name: ts.PropertyName): string => {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
    return name.text;
  }
  throw unresolved(scope, name, "property name");
};

const resolveObjectLiteral = (
  scope: ModuleScope,
  expression: ts.Expression,
): ts.ObjectLiteralExpression => {
  const node = unwrapExpression(expression);
  if (ts.isObjectLiteralExpression(node)) {
    return node;
  }
  if (ts.isIdentifier(node)) {
    const constant = scope.constants.get(node.text);
    if (constant) {
      return resolveObjectLiteral(scope, constant);
    }
  }
  throw unresolved(scope, node, "object shape");
};

const schemaAcceptsUndefined = (
  scope: ModuleScope,
  expression: ts.Expression,
  visited: Set<string>,
): boolean => {
  const node = unwrapExpression(expression);
  if (ts.isIdentifier(node)) {
    const constant = scope.constants.get(node.text);
    if (!constant || visited.has(node.text)) {
      throw unresolved(scope, node, "schema identifier");
    }

    return schemaAcceptsUndefined(
      scope,
      constant,
      new Set([...visited, node.text]),
    );
  }
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    throw unresolved(scope, node, "schema factory");
  }
  if (!ts.isCallExpression(node)) {
    throw unresolved(scope, node, "schema expression");
  }

  const callee = node.expression;
  if (ts.isIdentifier(callee)) {
    const helperOptional = KNOWN_FIELD_HELPERS[callee.text];
    if (helperOptional !== undefined) {
      return helperOptional;
    }
    const constant = scope.constants.get(callee.text);
    if (
      constant &&
      (ts.isArrowFunction(constant) || ts.isFunctionExpression(constant)) &&
      !ts.isBlock(constant.body)
    ) {
      return schemaAcceptsUndefined(scope, constant.body, visited);
    }
    throw unresolved(scope, node, `helper ${callee.text}`);
  }

  const factory = zodFactoryName(callee);
  if (factory !== undefined) {
    if (ACCEPTS_UNDEFINED_SCHEMAS.has(factory)) {
      return true;
    }
    if (factory === "union") {
      const [members] = node.arguments;
      if (!members || !ts.isArrayLiteralExpression(members)) {
        throw unresolved(scope, node, "union members");
      }

      return members.elements.some((member) =>
        schemaAcceptsUndefined(scope, member, visited),
      );
    }
    if (factory === "preprocess") {
      const inner = node.arguments[1];
      if (!inner) {
        throw unresolved(scope, node, "preprocess schema");
      }

      return schemaAcceptsUndefined(scope, inner, visited);
    }

    return false;
  }

  if (ts.isPropertyAccessExpression(callee)) {
    if (OPTIONAL_MARKERS.has(callee.name.text)) {
      return true;
    }

    return schemaAcceptsUndefined(scope, callee.expression, visited);
  }

  throw unresolved(scope, node, "schema call");
};

const collectShapeKeys = (
  scope: ModuleScope,
  shape: ts.ObjectLiteralExpression,
): RouteBodyKey[] =>
  shape.properties.flatMap((property): RouteBodyKey[] => {
    if (ts.isSpreadAssignment(property)) {
      return collectShapeKeys(
        scope,
        resolveObjectLiteral(scope, property.expression),
      );
    }
    if (ts.isPropertyAssignment(property)) {
      return [
        {
          name: propertyName(scope, property.name),
          optional: schemaAcceptsUndefined(
            scope,
            property.initializer,
            new Set(),
          ),
        },
      ];
    }
    throw unresolved(scope, property, "shape property");
  });

const resolveBodyShape = (
  scope: ModuleScope,
  expression: ts.Expression,
): ts.ObjectLiteralExpression => {
  const node = unwrapExpression(expression);
  if (ts.isIdentifier(node)) {
    const constant = scope.constants.get(node.text);
    if (!constant) {
      throw unresolved(scope, node, "body validator identifier");
    }

    return resolveBodyShape(scope, constant);
  }
  if (ts.isCallExpression(node)) {
    if (isZodMember(node.expression, "object")) {
      const [shape] = node.arguments;
      if (!shape) {
        throw unresolved(scope, node, "z.object shape");
      }

      return resolveObjectLiteral(scope, shape);
    }
    if (
      ts.isPropertyAccessExpression(node.expression) &&
      PASSTHROUGH_OBJECT_METHODS.has(node.expression.name.text)
    ) {
      return resolveBodyShape(scope, node.expression.expression);
    }
  }
  throw unresolved(scope, node, "body validator");
};

const findRequestValidatorOptions = (
  scope: ModuleScope,
): ts.ObjectLiteralExpression => {
  let options: ts.ObjectLiteralExpression | undefined;
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "createRequestValidator"
    ) {
      const [argument] = node.arguments;
      if (argument && ts.isObjectLiteralExpression(argument)) {
        options = argument;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(scope.sourceFile);
  if (!options) {
    throw new UnresolvedRouteSchemaError(
      `${scope.filePath}: createRequestValidator({...}) not found`,
    );
  }

  return options;
};

const findOption = (
  scope: ModuleScope,
  options: ts.ObjectLiteralExpression,
  name: string,
): ts.Expression | undefined => {
  for (const property of options.properties) {
    if (
      ts.isShorthandPropertyAssignment(property) &&
      property.name.text === name
    ) {
      return property.name;
    }
    if (
      ts.isPropertyAssignment(property) &&
      propertyName(scope, property.name) === name
    ) {
      return property.initializer;
    }
  }

  return undefined;
};

export const readRouteConfigContract = (
  filePath: string,
  source: string,
): RouteConfigContract => {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const scope: ModuleScope = {
    sourceFile,
    constants: collectTopLevelConstants(sourceFile),
    filePath,
  };
  const options = findRequestValidatorOptions(scope);
  const userOption = findOption(scope, options, "user");
  const bodyOption = findOption(scope, options, "body");
  const bodyKeys = bodyOption
    ? collectShapeKeys(scope, resolveBodyShape(scope, bodyOption))
    : [];

  return {
    userGuard: userOption ? userOption.getText(sourceFile) : "",
    bodyKeys,
  };
};
