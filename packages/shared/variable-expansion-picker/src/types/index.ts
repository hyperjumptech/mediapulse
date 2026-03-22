export type VariableOption = {
  key: string;
  /** Optional note from the variable record (shown right-aligned in the picker row). */
  description?: string | null;
};

export type ExpansionOption = {
  id: string;
  name: string;
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
