"use client";

import { X } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

import { useListSearch } from "@/hooks/use-list-search";
import type { ListUrlState } from "@/lib/data-table/list-url-state";

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
  const { value, setValue, submit, reset, isPending } = useListSearch(urlState);
  const inputId = `${tableId}-search`;

  return (
    <form
      role="search"
      aria-label={label}
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Label htmlFor={inputId} className="sr-only">
        {label}
      </Label>
      <Input
        id={inputId}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        aria-busy={isPending}
        className="h-8 w-[150px] lg:w-[250px] [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 lg:px-3"
          onClick={reset}
        >
          Reset
          <X aria-hidden />
        </Button>
      ) : null}
    </form>
  );
};
