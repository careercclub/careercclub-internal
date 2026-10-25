import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";
import { withPostgres } from "@/lib/db/postgres";

export type TalentPoolRecord = ApiRecord & {
  nama: string;
  email?: string | null;
  wa?: string | null;
  status?: string | null;
  sumber?: string | null;
  universitas?: string | null;
  campus_tier?: string | null;
  target_mt?: string | null;
  posisi_mt?: string | null;
  produk_dibeli?: string | null;
};

const talentPool = createTableApi<TalentPoolRecord>("talent_pool", {
  orderBy: "created_at",
  ascending: false,
});

export const listTalentPool = talentPool.list;
export const countTalentPool = talentPool.count;
export const getTalentPoolRecord = talentPool.get;
export const createTalentPoolRecord = talentPool.create;
export const updateTalentPoolRecord = talentPool.update;
export const deleteTalentPoolRecord = talentPool.remove;

export function listTalentPoolWithBuyerMatches() {
  return withPostgres(async (sql) => {
    const rows = await sql<(TalentPoolRecord & { buyer_match: boolean })[]>`
      select t.*,
        exists (
          select 1
          from buyers b
          where (
            ccc_normalize_wa(t.wa) <> ''
            and ccc_normalize_wa(b.wa) = ccc_normalize_wa(t.wa)
          ) or (
            btrim(coalesce(t.email, '')) <> ''
            and lower(btrim(b.email)) = lower(btrim(t.email))
          )
        ) as buyer_match
      from talent_pool t
      order by t.created_at desc
    `;

    return [...rows];
  });
}

/** Columns the sheet fills. Matched by email; a cell left empty in the sheet never clears what is
 * stored (so a re-import or the hourly sync keeps what the team added), and columns the sheet does
 * not have (pipeline, …) are never touched. Rows that are not in the sheet stay. */
const SHEET_COLUMNS = [
  "nama", "wa", "status", "sumber", "domisili", "universitas", "campus_tier", "fakultas", "pendidikan", "ipk", "angkatan", "tahun_lulus",
  "organisasi", "exchange", "relocate", "topik_minat", "target_mt", "posisi_mt", "pipeline", "produk_dibeli", "kepuasan", "membantu", "nps",
  "feedback", "kode_voucher", "linkedin",
] as const;

export function importTalentPoolRows(rows: Array<Record<string, string | number | null>>) {
  return withPostgres(async (sql) => sql.begin(async (tx) => {
    let added = 0;
    let updated = 0;
    let skipped = 0;
    // The same email twice in the sheet: the later (newer) row wins, filled cells only.
    const byEmail = new Map<string, Record<string, string>>();
    for (const row of rows) {
      const email = String(row.email || "").trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { skipped += 1; continue; }
      const values = byEmail.get(email) || {};
      for (const column of SHEET_COLUMNS) { const value = String(row[column] ?? "").trim(); if (value) values[column] = value; }
      byEmail.set(email, values);
    }
    for (const [email, values] of byEmail) {
      const record = Object.fromEntries(SHEET_COLUMNS.map((column) => [column, values[column] || ""]));
      const [result] = await tx<Array<{ inserted: boolean; changed: boolean }>>`
        insert into talent_pool ${tx({ email, ...record })}
        on conflict (email) do update set
          ${tx.unsafe(SHEET_COLUMNS.map((column) => `${column} = coalesce(nullif(excluded.${column}, ''), talent_pool.${column})`).join(", "))},
          updated_at = case when (${tx.unsafe(SHEET_COLUMNS.map((column) => `talent_pool.${column}`).join(", "))}) is distinct from (${tx.unsafe(SHEET_COLUMNS.map((column) => `coalesce(nullif(excluded.${column}, ''), talent_pool.${column})`).join(", "))}) then now() else talent_pool.updated_at end
        returning (xmax = 0) as inserted, updated_at >= now() as changed`;
      if (result.inserted) added += 1; else if (result.changed) updated += 1;
    }
    const imported = added + updated;
    return { imported, added, updated, unchanged: byEmail.size - added - updated, skipped };
  }));
}
