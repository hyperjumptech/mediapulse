export type VariableOption = {
  key: string;
  /** Optional note from the variable record (shown right-aligned in the picker row). */
  description?: string | null;
};

export type ExpansionOption = {
  /** Persistent template id used in step-input token references: `{{dse:<id>}}`. */
  id: string;
  name: string;
  /** Raw expansion expression (e.g. `db:ticker:id?take=10`) shown for context in picker rows. */
  expansionString: string;
  /** Optional description from the expansion record (shown right-aligned in the picker row). */
  description?: string | null;
};

/** Arguments for paginated picker loaders (1-based page). */
export type LoadPageArgs = {
  page: number;
  pageSize: number;
  search: string;
};

export type LoadVariablesPageResult = {
  items: VariableOption[];
  total: number;
};

export type LoadExpansionsPageResult = {
  items: ExpansionOption[];
  total: number;
};
