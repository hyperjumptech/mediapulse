import Form from "next/form";
import Link from "next/link";
import { Search, X } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group";
import { Label } from "@workspace/ui/components/label";

import {
  buildClearSearchHref,
  type ListUrlState,
} from "@/lib/data-table/list-url-state";

type DataTableSearchProps = {
  tableId: string;
  urlState: ListUrlState;
  label: string;
  placeholder: string;
};

export const DataTableSearch = ({
  tableId,
  urlState,
  label,
  placeholder,
}: DataTableSearchProps) => {
  const inputId = `${tableId}-search`;
  const hasActiveSearch = Boolean(urlState.search);

  return (
    <Form
      action={urlState.basePath}
      role="search"
      aria-label={label}
      className="w-full sm:max-w-sm"
    >
      <input type="hidden" name="size" value={urlState.pageSize} />
      {urlState.sortBy ? (
        <input type="hidden" name="sort" value={urlState.sortBy} />
      ) : null}
      <input type="hidden" name="dir" value={urlState.sortDir} />
      {Object.entries(urlState.extra ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Label htmlFor={inputId} className="sr-only">
        {label}
      </Label>
      <InputGroup className="bg-background">
        <InputGroupAddon>
          <Search aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          id={inputId}
          type="search"
          name="q"
          defaultValue={urlState.search ?? ""}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="search"
          className="[&::-webkit-search-cancel-button]:appearance-none"
        />
        {hasActiveSearch ? (
          <InputGroupAddon align="inline-end">
            <Link
              href={buildClearSearchHref(urlState)}
              aria-label="Clear search"
              className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X aria-hidden className="size-4" />
            </Link>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
    </Form>
  );
};
