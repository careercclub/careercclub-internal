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

export function importTalentPoolRows(rows: Array<Record<string, string | number | null>>) {
  return withPostgres(async (sql) => sql.begin(async (tx) => {
    let imported = 0;
    let skipped = 0;
    for (const row of rows) {
      const email = String(row.email || "").trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { skipped += 1; continue; }
      await tx`
        insert into talent_pool (
          nama, email, wa, status, sumber, domisili, universitas, campus_tier,
          ipk, tahun_lulus, target_mt, posisi_mt, pipeline, produk_dibeli, feedback
        ) values (
          ${String(row.nama || "")}, ${email}, ${String(row.wa || "")}, ${String(row.status || "")},
          ${String(row.sumber || "")}, ${String(row.domisili || "")}, ${String(row.universitas || "")},
          ${String(row.campus_tier || "")}, ${String(row.ipk || "")}, ${String(row.tahun_lulus || "")},
          ${String(row.target_mt || "")}, ${String(row.posisi_mt || "")}, ${String(row.pipeline || "")},
          ${String(row.produk_dibeli || "")}, ${String(row.feedback || "")}
        )
        on conflict (email) do update set
          nama = excluded.nama, wa = excluded.wa, status = excluded.status, sumber = excluded.sumber,
          domisili = excluded.domisili, universitas = excluded.universitas, campus_tier = excluded.campus_tier,
          ipk = excluded.ipk, tahun_lulus = excluded.tahun_lulus, target_mt = excluded.target_mt,
          posisi_mt = excluded.posisi_mt, pipeline = excluded.pipeline,
          produk_dibeli = excluded.produk_dibeli, feedback = excluded.feedback
      `;
      imported += 1;
    }
    return { imported, skipped };
  }));
}
