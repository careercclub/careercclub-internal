// Column mapping for the Talent Pool intake sheet (a Google Form export).
//
// Two things make this sheet awkward:
//   * Its header row is not always row 1 — exports carry a banner row above it
//     (the August 2026 file puts a bare record count in column 3 of row 1).
//   * Its headers are full survey questions ("Domisili kamu saat ini"), not field
//     names, so exact alias matching only ever catches a handful of columns.
// So the mapping is: locate the header row, alias-match what we can, then fill the
// remaining fields positionally once the layout has been fingerprinted.
//
// Keep this module free of imports: the fixture test loads it directly under
// `node --test`, so a `server-only` or ExcelJS import here would break that.

export const talentPoolColumns = {
  timestamp: 0,
  wa: 1,
  email: 2,
  nama: 3,
  status: 4,
  sumber: 6,
  topik_minat: 7,
  domisili: 9,
  relocate: 10,
  pendidikan: 11,
  universitas: 12,
  campus_tier: 13,
  ipk: 14,
  fakultas: 15,
  angkatan: 16,
  tahun_lulus: 17,
  organisasi: 18,
  exchange: 19,
  target_mt: 20,
  posisi_mt: 21,
  linkedin: 22,
  produk_dibeli: 24,
  kepuasan: 25,
  membantu: 26,
  nps: 27,
  feedback: 28,
  kode_voucher: 29,
} as const;

export type TalentPoolColumn = keyof typeof talentPoolColumns;

export const talentPoolAliases: Record<TalentPoolColumn | "pipeline", string[]> = {
  timestamp: ["timestamp"],
  nama: ["nama", "name", "full_name"],
  email: ["email", "email_address"],
  wa: ["wa", "whatsapp", "phone", "no_wa"],
  status: ["status"],
  sumber: ["sumber", "source"],
  domisili: ["domisili", "city", "kota"],
  universitas: ["universitas", "university", "campus"],
  campus_tier: ["campus_tier", "tier_kampus"],
  ipk: ["ipk", "gpa"],
  fakultas: ["fakultas", "faculty"],
  pendidikan: ["pendidikan", "education"],
  angkatan: ["angkatan", "cohort"],
  tahun_lulus: ["tahun_lulus", "graduation_year"],
  organisasi: ["organisasi", "organization"],
  exchange: ["exchange"],
  relocate: ["relocate", "bersedia_relocate"],
  topik_minat: ["topik_minat", "interest"],
  target_mt: ["target_mt"],
  posisi_mt: ["posisi_mt", "target_role"],
  linkedin: ["linkedin"],
  pipeline: ["pipeline", "stage"],
  produk_dibeli: ["produk_dibeli", "purchased_product"],
  kepuasan: ["kepuasan"],
  membantu: ["membantu"],
  nps: ["nps"],
  feedback: ["feedback", "notes"],
  kode_voucher: ["kode_voucher", "voucher_code"],
};

export function normalizeHeaderKey(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

// The sheet's own header text for the columns the positional map depends on. If
// these line up, the remaining positions can be trusted for this row. The layout may
// sit a few columns to the right (a "No" or checkbox column inserted before
// Timestamp), so this returns how far it is shifted, or null when it is not there.
export function knownLayoutOffset(headerKeys: string[]): number | null {
  for (let wa = 1; wa < Math.min(headerKeys.length, 12); wa += 1) {
    const offset = wa - 1;
    if (headerKeys[wa]?.includes("whatsapp") && headerKeys[wa + 1]?.includes("email") && headerKeys[wa + 2]?.includes("nama") && headerKeys.length - offset >= 30) return offset;
  }
  return null;
}

export function matchesKnownLayout(headerKeys: string[]) {
  return knownLayoutOffset(headerKeys) !== null;
}

/** lynk.id order export ("Judul Barang", "Buyer Email", …): belongs in CRM → Import. */
export function isOrderExport(headerKeys: string[]) {
  return headerKeys.includes("judul_barang") || headerKeys.some((key) => key.startsWith("buyer_"));
}

const has = (keys: string[], test: (key: string) => boolean) => keys.some((key) => key && test(key));
const tokens = (key: string) => key.split("_");

/** A header row we can map by name even when it is not the intake layout: it has an
 * email column plus a name or WhatsApp column. */
export function looksLikeHeader(headerKeys: string[]) {
  if (isOrderExport(headerKeys)) return false;
  return has(headerKeys, (key) => tokens(key).includes("email"))
    && has(headerKeys, (key) => tokens(key).includes("nama") || tokens(key).includes("name") || tokens(key).includes("whatsapp") || key === "wa");
}

// Returns the 0-based index of the header row, or -1 when none of the scanned rows
// looks like a header. The intake layout wins over a merely name-mappable row.
export function detectHeaderRow(rowsOfKeys: string[][], maxScan = 20) {
  const limit = Math.min(maxScan, rowsOfKeys.length);
  for (let index = 0; index < limit; index += 1) if (matchesKnownLayout(rowsOfKeys[index])) return index;
  for (let index = 0; index < limit; index += 1) if (looksLikeHeader(rowsOfKeys[index])) return index;
  return -1;
}

// Exact match first, then token-boundary match so a full survey question
// ("domisili_kamu_saat_ini") still resolves to its short field name. Substring
// matching is deliberately anchored on "_" so short aliases like "wa" cannot
// collide with unrelated words.
function findByAlias(headerKeys: string[], at: (index: number) => string, names: string[]) {
  for (const name of names) {
    const exact = headerKeys.indexOf(name);
    if (exact >= 0) return at(exact);
  }
  for (const name of names) {
    const loose = headerKeys.findIndex((keyName) => keyName.startsWith(`${name}_`) || keyName.includes(`_${name}_`) || keyName.endsWith(`_${name}`));
    if (loose >= 0) return at(loose);
  }
  return "";
}

export function mapTalentPoolRowByPosition(at: (index: number) => string) {
  const row = {} as Record<TalentPoolColumn, string>;
  for (const [field, index] of Object.entries(talentPoolColumns)) {
    row[field as TalentPoolColumn] = at(index);
  }
  return row;
}

// One row of the sheet as a flat record. `headerKeys` are the normalized keys of
// the detected header row (empty array when no header was found).
export function mapTalentPoolRow(headerKeys: string[], at: (index: number) => string, cellCount: number) {
  const target: Record<string, string> = {};
  for (const [field, names] of Object.entries(talentPoolAliases)) {
    target[field] = findByAlias(headerKeys, at, names);
  }

  const offset = knownLayoutOffset(headerKeys);
  if (offset !== null) {
    // Known layout: positions are trustworthy, so fill anything the survey-question
    // headers could not resolve by name.
    const positional = mapTalentPoolRowByPosition((index) => at(index + offset));
    for (const [field, value] of Object.entries(positional)) {
      if (!target[field] && value) target[field] = value;
    }
  } else if (!target.email && !target.nama && cellCount >= 20) {
    // Unrecognized header but a wide row — the legacy last resort.
    Object.assign(target, mapTalentPoolRowByPosition(at));
  }

  return target;
}
