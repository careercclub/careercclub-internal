import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";
import { scoreAdsCandidate, scoreContentEvaluation } from "@/lib/analytics/content";
import { withPostgres } from "@/lib/db/postgres";

export type MetaAdsContentRecord = ApiRecord;

const adsContents = createTableApi<MetaAdsContentRecord>("ads_contents", {
  orderBy: "created_at",
  ascending: false,
});

export const listAdsContents = adsContents.list;
export const countAdsContents = adsContents.count;
export const getAdsContent = adsContents.get;
export const createAdsContent = adsContents.create;
export const updateAdsContent = adsContents.update;
export const deleteAdsContent = adsContents.remove;

export function syncAdsFromContentEvaluations() {
  return withPostgres(async (sql) => sql.begin(async (tx) => {
    const evaluations = await tx<(ApiRecord & { format?: string })[]>`
      select * from content_evaluations order by tanggal desc
    `;
    const eligible = evaluations.filter((row) => {
      const format = String(row.format || "").toLowerCase();
      return (format.includes("reel") || format.includes("carousel")) && scoreContentEvaluation(row) >= 70;
    });
    const eligibleIds = eligible.map((row) => String(row.id));
    for (const row of eligible) {
      const derived = scoreAdsCandidate(row);
      await tx`
        insert into ads_contents (
          eval_id, judul, format, tanggal, reach, impressions, views, likes,
          comments, saves, shares, link_taps, follows, funnel, objective, ad_decision
        ) values (
          ${row.id}, ${String(row.judul || "")}, ${String(row.format || "Carousel")},
          ${row.tanggal || null}, ${Number(row.reach || 0)}, ${Number(row.impressions || 0)},
          ${Number(row.views || 0)}, ${Number(row.likes || 0)}, ${Number(row.comments || 0)},
          ${Number(row.saves || 0)}, ${Number(row.shares || 0)}, ${Number(row.link_taps || 0)},
          ${Number(row.follows || 0)}, ${derived.funnel}, ${derived.objective}, 'Pending'
        )
        on conflict (eval_id) where eval_id is not null do update set
          judul = excluded.judul, format = excluded.format, tanggal = excluded.tanggal,
          reach = excluded.reach, impressions = excluded.impressions, views = excluded.views,
          likes = excluded.likes, comments = excluded.comments, saves = excluded.saves,
          shares = excluded.shares, link_taps = excluded.link_taps, follows = excluded.follows,
          funnel = excluded.funnel, objective = excluded.objective
      `;
    }
    const removed = eligibleIds.length
      ? await tx`delete from ads_contents where eval_id is not null and not (eval_id = any(${eligibleIds}::uuid[]))`
      : await tx`delete from ads_contents where eval_id is not null`;
    return { synchronized: eligible.length, removed: removed.count || 0 };
  }));
}
