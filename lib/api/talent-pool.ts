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
