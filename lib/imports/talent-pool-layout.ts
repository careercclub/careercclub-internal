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
// these line up, the remaining positions can be trusted for this row.
export function matchesKnownLayout(headerKeys: string[]) {
  return headerKeys.length >= 30
    && headerKeys[1]?.includes("whatsapp")
    && headerKeys[2]?.includes("email")
    && headerKeys[3]?.includes("nama");
}

// Returns the 0-based index of the header row, or -1 when none of the scanned rows
// looks like this sheet's header.
export function detectHeaderRow(rowsOfKeys: string[][], maxScan = 5) {
  for (let index = 0; index < Math.min(maxScan, rowsOfKeys.length); index += 1) {
    if (matchesKnownLayout(rowsOfKeys[index])) return index;
  }
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

  if (matchesKnownLayout(headerKeys)) {
    // Known layout: positions are trustworthy, so fill anything the survey-question
    // headers could not resolve by name.
    const positional = mapTalentPoolRowByPosition(at);
    for (const [field, value] of Object.entries(positional)) {
      if (!target[field] && value) target[field] = value;
    }
  } else if (!target.email && !target.nama && cellCount >= 20) {
    // Unrecognized header but a wide row — the legacy last resort.
    Object.assign(target, mapTalentPoolRowByPosition(at));
  }

  return target;
}
