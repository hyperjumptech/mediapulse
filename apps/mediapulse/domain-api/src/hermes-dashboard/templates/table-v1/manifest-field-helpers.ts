import type {
  DashboardColumnFormat,
  DashboardColumnTone,
  DashboardPageColumn,
} from "@hermes/domain-contract";

export type ManifestColumnType = DashboardPageColumn["type"];

export type ManifestColumnBreakpoint = NonNullable<
  DashboardPageColumn["hideBelow"]
>;

export type ManifestColumnMobileRole = NonNullable<
  DashboardPageColumn["mobile"]
>;

export type ManifestColumnBadgeTones = Readonly<
  Record<string, DashboardColumnTone>
>;

export type ManifestColumn<K extends string = string> = {
  key: K;
  label: string;
  type: ManifestColumnType;
  format?: DashboardColumnFormat;
  badgeTones?: ManifestColumnBadgeTones;
  hideBelow?: ManifestColumnBreakpoint;
  mobile?: ManifestColumnMobileRole;
  defaultHidden?: boolean;
};

export const yesNoBadgeTones = {
  Yes: "success",
  No: "muted",
} as const satisfies ManifestColumnBadgeTones;

export const columnsFor =
  <Row extends Record<string, unknown>>() =>
  <K extends keyof Row & string>(
    columns: ReadonlyArray<ManifestColumn<K>>,
  ): ManifestColumn<K>[] => [...columns];

export const rowFieldKeysFor =
  <Row extends Record<string, unknown>>() =>
  <K extends keyof Row & string>(keys: readonly K[]): K[] => [...keys];

export const previewFieldFor =
  <Row extends Record<string, unknown>>() =>
  <K extends keyof Row & string>(
    fieldKey: K,
  ): { enabled: true; fieldKey: K } => ({
    enabled: true,
    fieldKey,
  });
