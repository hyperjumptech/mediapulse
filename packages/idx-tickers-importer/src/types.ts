/**
 * Single listed company / emiten row from IDX API response.
 * Field names match the IDX JSON (Indonesian labels).
 */
export type IdxEmitenRow = {
  Alamat?: string | null;
  BAE?: string | null;
  DataID?: number | null;
  Divisi?: string | null;
  EfekEmiten_EBA?: boolean | null;
  EfekEmiten_ETF?: boolean | null;
  EfekEmiten_Obligasi?: boolean | null;
  EfekEmiten_Saham?: boolean | null;
  EfekEmiten_SPEI?: boolean | null;
  Industri?: string | null;
  SubIndustri?: string | null;
  Email?: string | null;
  Fax?: string | null;
  id?: number | null;
  JenisEmiten?: string | null;
  KegiatanUsahaUtama?: string | null;
  KodeDivisi?: string | null;
  KodeEmiten: string;
  NamaEmiten: string;
  NPKP?: string | null;
  NPWP?: string | null;
  PapanPencatatan?: string | null;
  Sektor?: string | null;
  SubSektor?: string | null;
  TanggalPencatatan?: string | null;
  Telepon?: string | null;
  Website?: string | null;
  Status?: number | null;
  Logo?: string | null;
  [key: string]: unknown;
};

/**
 * IDX API response shape (e.g. listed companies table payload).
 */
export type IdxTickersPayload = {
  draw?: number;
  recordsTotal?: number;
  recordsFiltered?: number;
  data: IdxEmitenRow[];
};
