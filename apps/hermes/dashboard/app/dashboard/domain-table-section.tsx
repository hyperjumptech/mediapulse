import type { ReactNode } from "react";
import type { TableV1MetaResponse } from "@hermes/domain-contract";

import type { ListUrlState } from "@/lib/data-table/list-url-state";
import { readColumnVisibility } from "@/lib/data-table/read-column-visibility";
import { getDomainTableList } from "@/lib/domain-dashboard";
import {
  buildDomainTableId,
  mergeDomainTableColumnVisibility,
} from "@/lib/domain-table-columns";
import type { DomainTableFormField } from "@/lib/domain-table-form-schema";
import {
  buildDomainTableFilterExtraParams,
  type DomainTableListParamsParsed,
} from "@/lib/domain-table-list-params";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

import { DomainDataTable, type DomainDataTableMeta } from "./domain-data-table";

type DomainTableSectionProps = {
  integrationId: string;
  resource: string;
  basePath: string;
  meta: TableV1MetaResponse;
  params: DomainTableListParamsParsed;
  updateFields: DomainTableFormField[];
  updateAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  toolbarFilters?: ReactNode;
  toolbarActions?: ReactNode;
};

const pickDomainDataTableMeta = (
  meta: TableV1MetaResponse,
): DomainDataTableMeta => ({
  title: meta.title,
  columns: meta.columns,
  sortableFields: meta.sortableFields,
  actions: meta.actions,
  createNavigation: meta.createNavigation,
});

export const DomainTableSection = async ({
  integrationId,
  resource,
  basePath,
  meta,
  params,
  updateFields,
  updateAction,
  deleteAction,
  toolbarFilters,
  toolbarActions,
}: DomainTableSectionProps) => {
  const tableId = buildDomainTableId(integrationId, resource);
  const [list, savedVisibility] = await Promise.all([
    withDashboardAdmin(getDomainTableList(integrationId, resource, params)),
    readColumnVisibility(tableId),
  ]);
  const urlState: ListUrlState = {
    basePath,
    page: list.page,
    pageSize: list.pageSize,
    total: list.total,
    search: params.query,
    sortBy: params.sortBy,
    sortDir: params.sortDir,
    extra: buildDomainTableFilterExtraParams(params.filters),
  };

  return (
    <DomainDataTable
      key={tableId}
      tableId={tableId}
      basePath={basePath}
      meta={pickDomainDataTableMeta(meta)}
      rows={list.items}
      urlState={urlState}
      updateFields={updateFields}
      updateAction={updateAction}
      deleteAction={deleteAction}
      toolbarFilters={toolbarFilters}
      toolbarActions={toolbarActions}
      initialColumnVisibility={mergeDomainTableColumnVisibility(
        meta.columns,
        savedVisibility,
      )}
    />
  );
};
