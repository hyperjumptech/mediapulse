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

export type ReadImportedModule = (
  specifier: string,
  importerPath: string,
) => { filePath: string; source: string } | undefined;

type ImportBinding = {
  specifier: string;
  importedName: string;
};

type ModuleScope = {
  sourceFile: ts.SourceFile;
  constants: Map<string, ts.Expression>;
  imports: Map<string, ImportBinding>;
  filePath: string;
  readImportedModule: ReadImportedModule;
};

type ScopedExpression = {
  scope: ModuleScope;
  expression: ts.Expression;
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

const collectNamedImports = (
  sourceFile: ts.SourceFile,
): Map<string, ImportBinding> => {
  const imports = new Map<string, ImportBinding>();
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue;
    }
    const namedBindings = statement.importClause?.namedBindings;
    if (!namedBindings || !ts.isNamedImports(namedBindings)) {
      continue;
    }
    for (const element of namedBindings.elements) {
      imports.set(element.name.text, {
        specifier: statement.moduleSpecifier.text,
        importedName: (element.propertyName ?? element.name).text,
      });
    }
  }

  return imports;
};

const createModuleScope = (
  filePath: string,
  source: string,
  readImportedModule: ReadImportedModule,
): ModuleScope => {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
  );

  return {
    sourceFile,
    constants: collectTopLevelConstants(sourceFile),
    imports: collectNamedImports(sourceFile),
    filePath,
    readImportedModule,
  };
};

const resolveIdentifier = (
  scope: ModuleScope,
  name: string,
): ScopedExpression | undefined => {
  const constant = scope.constants.get(name);
  if (constant) {
    return { scope, expression: constant };
  }
  const binding = scope.imports.get(name);
  if (!binding) {
    return undefined;
  }
  const importedModule = scope.readImportedModule(
    binding.specifier,
    scope.filePath,
  );
  if (!importedModule) {
    return undefined;
  }
  const importedScope = createModuleScope(
    importedModule.filePath,
    importedModule.source,
    scope.readImportedModule,
  );

  return resolveIdentifier(importedScope, binding.importedName);
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

type ScopedObjectLiteral = {
  scope: ModuleScope;
  shape: ts.ObjectLiteralExpression;
};

const resolveObjectLiteral = (
  scope: ModuleScope,
  expression: ts.Expression,
): ScopedObjectLiteral => {
  const node = unwrapExpression(expression);
  if (ts.isObjectLiteralExpression(node)) {
    return { scope, shape: node };
  }
  if (ts.isIdentifier(node)) {
    const resolved = resolveIdentifier(scope, node.text);
    if (resolved) {
      return resolveObjectLiteral(resolved.scope, resolved.expression);
    }
  }
  throw unresolved(scope, node, "object shape");
};

const visitKey = (scope: ModuleScope, name: string): string =>
  `${scope.filePath}#${name}`;

const schemaAcceptsUndefined = (
  scope: ModuleScope,
  expression: ts.Expression,
  visited: Set<string>,
): boolean => {
  const node = unwrapExpression(expression);
  if (ts.isIdentifier(node)) {
    const resolved = resolveIdentifier(scope, node.text);
    const key = visitKey(scope, node.text);
    if (!resolved || visited.has(key)) {
      throw unresolved(scope, node, "schema identifier");
    }

    return schemaAcceptsUndefined(
      resolved.scope,
      resolved.expression,
      new Set([...visited, key]),
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
    const resolved = resolveIdentifier(scope, callee.text);
    const helper = resolved ? unwrapExpression(resolved.expression) : undefined;
    if (
      resolved &&
      helper &&
      (ts.isArrowFunction(helper) || ts.isFunctionExpression(helper)) &&
      !ts.isBlock(helper.body)
    ) {
      return schemaAcceptsUndefined(resolved.scope, helper.body, visited);
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

const collectShapeKeys = ({
  scope,
  shape,
}: ScopedObjectLiteral): RouteBodyKey[] =>
  shape.properties.flatMap((property): RouteBodyKey[] => {
    if (ts.isSpreadAssignment(property)) {
      return collectShapeKeys(resolveObjectLiteral(scope, property.expression));
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
): ScopedObjectLiteral => {
  const node = unwrapExpression(expression);
  if (ts.isIdentifier(node)) {
    const resolved = resolveIdentifier(scope, node.text);
    if (!resolved) {
      throw unresolved(scope, node, "body validator identifier");
    }

    return resolveBodyShape(resolved.scope, resolved.expression);
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

const readNoImportedModule: ReadImportedModule = () => undefined;

export const readRouteConfigContract = (
  filePath: string,
  source: string,
  readImportedModule: ReadImportedModule = readNoImportedModule,
): RouteConfigContract => {
  const scope = createModuleScope(filePath, source, readImportedModule);
  const options = findRequestValidatorOptions(scope);
  const userOption = findOption(scope, options, "user");
  const bodyOption = findOption(scope, options, "body");
  const bodyKeys = bodyOption
    ? collectShapeKeys(resolveBodyShape(scope, bodyOption))
    : [];

  return {
    userGuard: userOption ? userOption.getText(scope.sourceFile) : "",
    bodyKeys,
  };
};
