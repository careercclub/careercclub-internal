import "server-only";
import { withPostgres } from "@/lib/db/postgres";

export type EmailBlastRecord = {
  id: string;
  sent_at: string;
  actor_name: string;
  source: string;
  segment: string;
  subject: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  scheduled_at: string | null;
  errors: string[];
};

export type DailyBlastCount = { day: string; sent: number };

export type EmailBlastLogInput = {
  actorUserId?: string | null;
  actorName: string;
  source: string;
  segment: string;
  subject: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  scheduledAt?: string | null;
  errors: string[];
};

export function logEmailBlast(input: EmailBlastLogInput) {
  return withPostgres(async (sql) => {
    await sql`
      insert into email_blast_log (
        actor_user_id, actor_name, source, segment, subject,
        recipient_count, sent_count, failed_count, scheduled_at, errors
      ) values (
        ${input.actorUserId || null}, ${input.actorName}, ${input.source}, ${input.segment}, ${input.subject},
        ${input.recipientCount}, ${input.sentCount}, ${input.failedCount},
        ${input.scheduledAt || null}, ${sql.json(input.errors.slice(0, 10))}::jsonb
      )
    `;
  });
}

export function listEmailBlasts(limit = 50) {
  return withPostgres(async (sql) => {
    const rows = await sql<EmailBlastRecord[]>`
      select id, sent_at, actor_name, source, segment, subject,
             recipient_count, sent_count, failed_count, scheduled_at, errors
      from email_blast_log
      order by sent_at desc
      limit ${limit}
    `;
    return [...rows];
  });
}

// One row per day for the last `days` days, zero-filled so the chart shows quiet days
// rather than silently compressing the axis. Days are Asia/Jakarta, matching how the
// rest of the app treats operational dates.
export function dailyBlastCounts(days = 30) {
  return withPostgres(async (sql) => {
    const rows = await sql<DailyBlastCount[]>`
      with span as (
        select generate_series(
          (now() at time zone 'Asia/Jakarta')::date - ${days - 1}::integer,
          (now() at time zone 'Asia/Jakarta')::date,
          interval '1 day'
        )::date as day
      )
      select to_char(span.day, 'YYYY-MM-DD') as day,
             coalesce(sum(entry.sent_count), 0)::integer as sent
      from span
      left join email_blast_log entry
        on (entry.sent_at at time zone 'Asia/Jakarta')::date = span.day
      group by span.day
      order by span.day
    `;
    return [...rows];
  });
}
