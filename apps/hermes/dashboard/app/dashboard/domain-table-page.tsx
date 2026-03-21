import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { ListPagination } from "@/components/list-pagination";
import { PageHeader } from "@/components/page-header";
import {
  createDomainTableItem,
  deleteDomainTableItem,
  getDomainTableList,
  getDomainTableMeta,
  updateDomainTableItem,
} from "@/lib/domain-dashboard";

type DomainTablePageProps = {
  resource: string;
  searchParams:
    | Promise<{
        page?: string;
        size?: string;
        q?: string;
        sort?: string;
        dir?: string;
      }>
    | {
        page?: string;
        size?: string;
        q?: string;
        sort?: string;
        dir?: string;
      };
};

type SchemaField = {
  key: string;
  label: string;
  required: boolean;
};

/**
 * Converts form data to a JSON payload, excluding internal fields.
 *
 * @param formData - Submitted form data.
 * @returns Object payload for domain API mutations.
 */
const formDataToPayload = (formData: FormData): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("__")) continue;
    payload[key] = value;
  }
  return payload;
};

/**
 * Parses stringly-typed search params into pagination/sort values.
 *
 * @param searchParams - Route search params object.
 * @returns Parsed values used by list calls.
 */
const parseListParams = (searchParams: {
  page?: string;
  size?: string;
  q?: string;
  sort?: string;
  dir?: string;
}) => {
  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(searchParams.size ?? "15", 10) || 15),
  );
  const query = searchParams.q?.trim() || undefined;
  const sortBy = searchParams.sort?.trim() || undefined;
  const sortDir = searchParams.dir === "desc" ? "desc" : "asc";
  return { page, pageSize, query, sortBy, sortDir } as const;
};

/**
 * Extracts text fields from a JSON schema-like object for form rendering.
 *
 * @param schema - Schema object from manifest/meta.
 * @returns Ordered field descriptors.
 */
const getSchemaFields = (schema: unknown): SchemaField[] => {
  if (!schema || typeof schema !== "object") return [];
  const objectSchema = schema as {
    properties?: Record<string, unknown>;
    required?: unknown;
  };
  const required = Array.isArray(objectSchema.required)
    ? objectSchema.required.filter(
        (entry): entry is string => typeof entry === "string",
      )
    : [];
  const properties = objectSchema.properties ?? {};
  return Object.entries(properties)
    .filter(([, value]) => typeof value === "object" && value !== null)
    .map(([key, value]) => {
      const property = value as { title?: unknown };
      return {
        key,
        label:
          typeof property.title === "string" && property.title.length > 0
            ? property.title
            : key,
        required: required.includes(key),
      };
    });
};

/**
 * Shared server-rendered table-v1 page for domain-registered resources.
 *
 * @param props - Resource key and request search params.
 * @returns Rendered page content.
 */
export const DomainTablePage = async ({
  resource,
  searchParams,
}: DomainTablePageProps) => {
  const resolved = await Promise.resolve(searchParams);
  const params = parseListParams(resolved);
  const [meta, list] = await Promise.all([
    getDomainTableMeta(resource),
    getDomainTableList(resource, params),
  ]);
  const createFields = getSchemaFields(meta.createSchema);
  const updateFields = getSchemaFields(meta.updateSchema);

  const createAction = async (formData: FormData) => {
    "use server";
    await createDomainTableItem(resource, formDataToPayload(formData));
    revalidatePath(`/dashboard/${resource}`);
    redirect(`/dashboard/${resource}`);
  };

  const updateAction = async (formData: FormData) => {
    "use server";
    const id = String(formData.get("__id") ?? "");
    if (!id) return;
    await updateDomainTableItem(resource, id, formDataToPayload(formData));
    revalidatePath(`/dashboard/${resource}`);
    redirect(`/dashboard/${resource}`);
  };

  const deleteAction = async (formData: FormData) => {
    "use server";
    const id = String(formData.get("__id") ?? "");
    if (!id) return;
    await deleteDomainTableItem(resource, id);
    revalidatePath(`/dashboard/${resource}`);
    redirect(`/dashboard/${resource}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={meta.title} description={meta.description ?? ""} />

      <form method="get" className="flex items-end gap-2">
        <div className="w-full max-w-md">
          <label className="text-sm font-medium" htmlFor="q">
            Search
          </label>
          <Input id="q" name="q" defaultValue={params.query ?? ""} />
        </div>
        <input type="hidden" name="size" value={String(params.pageSize)} />
        <Button type="submit">Apply</Button>
      </form>

      {meta.actions.create && createFields.length > 0 ? (
        <details className="rounded-md border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Create new
          </summary>
          <form action={createAction} className="mt-4 grid gap-3">
            {createFields.map((field) => (
              <label key={field.key} className="grid gap-1 text-sm">
                <span>{field.label}</span>
                <Input name={field.key} required={field.required} />
              </label>
            ))}
            <div>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </details>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              {meta.columns.map((column) => (
                <th
                  key={column.key}
                  className="px-3 py-2 text-left font-medium"
                >
                  {column.label}
                </th>
              ))}
              {(meta.actions.update || meta.actions.delete) && (
                <th className="px-3 py-2 text-left font-medium">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {list.items.map((item) => {
              const row = item as Record<string, unknown>;
              const rowId = String(row.id ?? "");
              return (
                <tr key={rowId} className="border-t">
                  {meta.columns.map((column) => (
                    <td key={`${rowId}-${column.key}`} className="px-3 py-2">
                      {String(row[column.key] ?? "")}
                    </td>
                  ))}
                  {(meta.actions.update || meta.actions.delete) && (
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        {meta.actions.update && updateFields.length > 0 ? (
                          <details>
                            <summary className="cursor-pointer text-xs underline">
                              Edit
                            </summary>
                            <form
                              action={updateAction}
                              className="mt-2 grid gap-2"
                            >
                              <input type="hidden" name="__id" value={rowId} />
                              {updateFields.map((field) => (
                                <label
                                  key={field.key}
                                  className="grid gap-1 text-xs"
                                >
                                  <span>{field.label}</span>
                                  <Input
                                    name={field.key}
                                    defaultValue={String(row[field.key] ?? "")}
                                    required={field.required}
                                  />
                                </label>
                              ))}
                              <Button size="sm" type="submit">
                                Save
                              </Button>
                            </form>
                          </details>
                        ) : null}
                        {meta.actions.delete ? (
                          <form action={deleteAction}>
                            <input type="hidden" name="__id" value={rowId} />
                            <Button
                              type="submit"
                              size="sm"
                              variant="outline"
                              className="text-destructive"
                            >
                              Delete
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ListPagination
        basePath={`/dashboard/${resource}`}
        page={list.page}
        pageSize={list.pageSize}
        total={list.total}
        ariaLabel={`${meta.title} list pagination`}
        searchQuery={params.query}
        sortBy={params.sortBy}
        sortDir={params.sortDir}
      />
    </div>
  );
};
