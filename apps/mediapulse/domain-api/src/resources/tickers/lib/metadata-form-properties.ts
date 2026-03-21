/**
 * Manifest JSON Schema `properties` map for ticker `metadata` (IDX-style emiten row) used in Hermes create/edit forms.
 * Hermes renders one control per key; keys omitted here stay in DB via PATCH merge but are not editable in the UI.
 */
export const tickerMetadataFormProperties: Record<string, unknown> = {
  id: { type: "integer", title: "ID (IDX)" },
  BAE: { type: "string", title: "BAE", nullable: true },
  Fax: { type: "string", title: "Fax", nullable: true },
  Logo: { type: "string", title: "Logo", nullable: true },
  NPKP: { type: "string", title: "NPKP", nullable: true },
  NPWP: { type: "string", title: "NPWP", nullable: true },
  Email: { type: "string", title: "Email", nullable: true },
  Alamat: {
    type: "string",
    title: "Alamat",
    format: "textarea",
    nullable: true,
  },
  DataID: { type: "integer", title: "Data ID" },
  Divisi: { type: "string", title: "Divisi", nullable: true },
  Sektor: { type: "string", title: "Sektor", nullable: true },
  Status: { type: "integer", title: "Status" },
  Telepon: { type: "string", title: "Telepon", nullable: true },
  Website: { type: "string", title: "Website", nullable: true },
  Industri: { type: "string", title: "Industri", nullable: true },
  SubSektor: { type: "string", title: "Sub-sektor", nullable: true },
  KodeDivisi: { type: "string", title: "Kode divisi", nullable: true },
  KodeEmiten: { type: "string", title: "Kode emiten", nullable: true },
  NamaEmiten: { type: "string", title: "Nama emiten", nullable: true },
  JenisEmiten: { type: "string", title: "Jenis emiten", nullable: true },
  SubIndustri: { type: "string", title: "Sub-industri", nullable: true },
  EfekEmiten_EBA: { type: "boolean", title: "Efek: EBA" },
  EfekEmiten_ETF: { type: "boolean", title: "Efek: ETF" },
  EfekEmiten_SPEI: { type: "boolean", title: "Efek: SPEI" },
  PapanPencatatan: {
    type: "string",
    title: "Papan pencatatan",
    nullable: true,
  },
  EfekEmiten_Saham: { type: "boolean", title: "Efek: Saham" },
  TanggalPencatatan: {
    type: "string",
    title: "Tanggal pencatatan",
    format: "date-time",
    nullable: true,
  },
  KegiatanUsahaUtama: {
    type: "string",
    title: "Kegiatan usaha utama",
    format: "textarea",
    nullable: true,
  },
  EfekEmiten_Obligasi: { type: "boolean", title: "Efek: Obligasi" },
};
