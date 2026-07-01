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
            follows = ${row.follows}, duration = ${row.duration}
          where id = ${existing.id}
        `;
        updated += 1;
      } else {
        await tx`
          insert into content_evaluations (
            post_id, account_id, account_username, description, judul, url, format,
            tanggal, views, reach, likes, comments, saves, shares, follows, duration
          ) values (
            ${row.postId}, ${row.accountId || null}, ${row.accountUsername || null}, ${row.description || null},
            ${row.title}, ${row.url}, ${row.format}, ${row.date}, ${row.views}, ${row.reach},
            ${row.likes}, ${row.comments}, ${row.saves}, ${row.shares}, ${row.follows}, ${row.duration}
          )
        `;
        inserted += 1;
      }
    }
    return { inserted, updated };
  }));
}
