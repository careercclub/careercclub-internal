import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";
import { withPostgres } from "@/lib/db/postgres";

export type ContentEvaluationRecord = ApiRecord;

const contentEvaluations = createTableApi<ContentEvaluationRecord>("content_evaluations", {
  orderBy: "tanggal",
  ascending: false,
});

export const listContentEvaluations = contentEvaluations.list;
export const countContentEvaluations = contentEvaluations.count;
export const getContentEvaluation = contentEvaluations.get;
export const createContentEvaluation = contentEvaluations.create;
export const updateContentEvaluation = contentEvaluations.update;
export const deleteContentEvaluation = contentEvaluations.remove;

export type ContentEvaluationImportRow = {
  postId: string; accountId: string; accountUsername: string; description: string;
  title: string; url: string; format: string; date: string | null;
  views: number | null; reach: number | null; likes: number | null; comments: number | null;
  saves: number | null; shares: number | null; follows: number | null; duration: number | null;
  nfPct: number | null; fromHome: number | null; fromProfile: number | null; fromOther: number | null;
  engaged: number | null; profileVisits: number | null; linkTaps: number | null;
  watchtime: number | null; wtr: number | null; replays: number | null; dropoff: number | null;
  tapsForward: number | null; tapsBack: number | null; exits: number | null;
  replies: number | null; stickersInteract: number | null;
};

export function importContentEvaluations(rows: ContentEvaluationImportRow[]) {
  return withPostgres(async (sql) => sql.begin(async (tx) => {
    let inserted = 0;
    let updated = 0;
    for (const row of rows) {
      const [existing] = await tx<{ id: string }[]>`select id from content_evaluations where post_id = ${row.postId} limit 1 for update`;
      if (existing) {
        await tx`
          update content_evaluations set
            account_id = ${row.accountId || null}, account_username = ${row.accountUsername || null},
            description = ${row.description || null}, judul = ${row.title}, url = ${row.url},
            format = ${row.format}, tanggal = ${row.date}, views = ${row.views}, reach = ${row.reach},
            likes = ${row.likes}, comments = ${row.comments}, saves = ${row.saves}, shares = ${row.shares},
            follows = ${row.follows}, duration = ${row.duration},
            nf_pct = coalesce(${row.nfPct}, nf_pct), from_home = coalesce(${row.fromHome}, from_home),
            from_profile = coalesce(${row.fromProfile}, from_profile), from_other = coalesce(${row.fromOther}, from_other),
            engaged = coalesce(${row.engaged}, engaged), profile_visits = coalesce(${row.profileVisits}, profile_visits),
            link_taps = coalesce(${row.linkTaps}, link_taps), watchtime = coalesce(${row.watchtime}, watchtime),
            wtr = coalesce(${row.wtr}, wtr), replays = coalesce(${row.replays}, replays),
            dropoff = coalesce(${row.dropoff}, dropoff), taps_forward = coalesce(${row.tapsForward}, taps_forward),
            taps_back = coalesce(${row.tapsBack}, taps_back), exits = coalesce(${row.exits}, exits),
            replies = coalesce(${row.replies}, replies), stickers_interact = coalesce(${row.stickersInteract}, stickers_interact)
          where id = ${existing.id}
        `;
        updated += 1;
      } else {
        await tx`
          insert into content_evaluations (
            post_id, account_id, account_username, description, judul, url, format,
            tanggal, views, reach, likes, comments, saves, shares, follows, duration,
            nf_pct, from_home, from_profile, from_other, engaged, profile_visits,
            link_taps, watchtime, wtr, replays, dropoff, taps_forward, taps_back,
            exits, replies, stickers_interact
          ) values (
            ${row.postId}, ${row.accountId || null}, ${row.accountUsername || null}, ${row.description || null},
            ${row.title}, ${row.url}, ${row.format}, ${row.date}, ${row.views}, ${row.reach},
            ${row.likes}, ${row.comments}, ${row.saves}, ${row.shares}, ${row.follows}, ${row.duration},
            ${row.nfPct}, ${row.fromHome}, ${row.fromProfile}, ${row.fromOther}, ${row.engaged},
            ${row.profileVisits}, ${row.linkTaps}, ${row.watchtime}, ${row.wtr}, ${row.replays},
            ${row.dropoff}, ${row.tapsForward}, ${row.tapsBack}, ${row.exits}, ${row.replies}, ${row.stickersInteract}
          )
        `;
        inserted += 1;
      }
    }
    return { inserted, updated };
  }));
}
