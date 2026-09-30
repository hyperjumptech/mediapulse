import {
  createDomainTableItem,
  deleteDomainTableItem,
  getDomainTableMeta,
  invokeDomainTableCustomAction,
  invokeDomainTableDangerConfirmAction,
  updateDomainTableItem,
} from "@/lib/domain-dashboard";
import { DomainIntegrationTimeoutError } from "@/lib/domain-integration-request";
import { DomainRequestError } from "@/lib/domain-request-error";

export type DomainRowMutationResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; message: string };

export type DomainRowMutationDependencies = {
  getMeta: typeof getDomainTableMeta;
  createItem: typeof createDomainTableItem;
  updateItem: typeof updateDomainTableItem;
  deleteItem: typeof deleteDomainTableItem;
  runJsonImport: typeof invokeDomainTableCustomAction;
  runDangerConfirm: typeof invokeDomainTableDangerConfirmAction;
};

const defaultDependencies: DomainRowMutationDependencies = {
  getMeta: getDomainTableMeta,
  createItem: createDomainTableItem,
  updateItem: updateDomainTableItem,
  deleteItem: deleteDomainTableItem,
  runJsonImport: invokeDomainTableCustomAction,
  runDangerConfirm: invokeDomainTableDangerConfirmAction,
};

type DomainTableMeta = Awaited<ReturnType<typeof getDomainTableMeta>>;

type RowAction = keyof DomainTableMeta["actions"];

type DomainRowTarget = {
  integrationId: string;
  resource: string;
};

const rejected = (
  status: number,
  message: string,
): DomainRowMutationResult => ({
  ok: false,
  status,
  message,
});

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const toFailureResult = (error: unknown): DomainRowMutationResult => {
  if (error instanceof DomainRequestError && error.status < 500) {
    return rejected(error.status, error.detail ?? error.message);
  }
  if (error instanceof DomainRequestError) {
    return rejected(502, error.message);
  }
  if (error instanceof DomainIntegrationTimeoutError) {
    return rejected(504, error.message);
  }
  throw error;
};

const loadMeta = async (
  { integrationId, resource }: DomainRowTarget,
  dependencies: DomainRowMutationDependencies,
): Promise<DomainTableMeta | DomainRowMutationResult> => {
  try {
    return await dependencies.getMeta(integrationId, resource);
  } catch (error) {
    if (
      error instanceof DomainRequestError ||
      error instanceof DomainIntegrationTimeoutError
    ) {
      return toFailureResult(error);
    }

    return rejected(404, errorMessage(error));
  }
};

const isMutationResult = (
  value: DomainTableMeta | DomainRowMutationResult,
): value is DomainRowMutationResult => "ok" in value;

const withAllowedAction = async (
  target: DomainRowTarget,
  action: RowAction,
  dependencies: DomainRowMutationDependencies,
  run: () => Promise<unknown>,
): Promise<DomainRowMutationResult> => {
  const meta = await loadMeta(target, dependencies);
  if (isMutationResult(meta)) {
    return meta;
  }
  if (!meta.actions[action]) {
    return rejected(
      403,
      `View "${target.resource}" does not allow ${action} on its rows`,
    );
  }
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    return toFailureResult(error);
  }
};

export const createDomainRow = (
  target: DomainRowTarget & { values: Record<string, unknown> },
  dependencies: DomainRowMutationDependencies = defaultDependencies,
): Promise<DomainRowMutationResult> =>
  withAllowedAction(target, "create", dependencies, () =>
    dependencies.createItem(
      target.integrationId,
      target.resource,
      target.values,
    ),
  );

export const updateDomainRow = (
  target: DomainRowTarget & { id: string; values: Record<string, unknown> },
  dependencies: DomainRowMutationDependencies = defaultDependencies,
): Promise<DomainRowMutationResult> =>
  withAllowedAction(target, "update", dependencies, () =>
    dependencies.updateItem(
      target.integrationId,
      target.resource,
      target.id,
      target.values,
    ),
  );

export const deleteDomainRow = (
  target: DomainRowTarget & { id: string },
  dependencies: DomainRowMutationDependencies = defaultDependencies,
): Promise<DomainRowMutationResult> =>
  withAllowedAction(target, "delete", dependencies, () =>
    dependencies.deleteItem(target.integrationId, target.resource, target.id),
  );

export const runDomainTableCustomAction = async (
  target: DomainRowTarget & { actionId: string; payloadJson?: string },
  dependencies: DomainRowMutationDependencies = defaultDependencies,
): Promise<DomainRowMutationResult> => {
  const meta = await loadMeta(target, dependencies);
  if (isMutationResult(meta)) {
    return meta;
  }
  const action = meta.customActions.find(
    (customAction) => customAction.id === target.actionId,
  );
  if (!action) {
    return rejected(404, `Unknown custom action "${target.actionId}"`);
  }
  if (action.ui === "json-file-upload" && !target.payloadJson?.trim()) {
    return rejected(400, `Custom action "${action.id}" needs payloadJson`);
  }
  try {
    const result =
      action.ui === "json-file-upload"
        ? await dependencies.runJsonImport(
            target.integrationId,
            target.resource,
            action.id,
            target.payloadJson ?? "",
          )
        : await dependencies.runDangerConfirm(
            target.integrationId,
            target.resource,
            action.id,
          );

    return result.success
      ? { ok: true, data: result.data }
      : rejected(400, result.message);
  } catch (error) {
    return toFailureResult(error);
  }
};
