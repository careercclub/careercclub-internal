import "server-only";
import type postgres from "postgres";
import { withPostgres } from "@/lib/db/postgres";
import { planPainPoints, summarisePainPoints, type ExistingPainPoint } from "@/lib/customer-knowledge/agent";

// Customer Knowledge through the Claude access API (rules in lib/customer-knowledge/agent.ts).

type Sql = postgres.Sql | postgres.TransactionSql;

function labelList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim()) { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; } }
  return [];
}

export async function painPointLists(sql: Sql) {
  const [platforms, categories] = await Promise.all([
    sql<Array<{ nama: string }>>`select nama from pain_point_platforms where coalesce(nama, '') <> '' order by nama`,
    sql<Array<{ nama: string }>>`select nama from pain_point_categories where coalesce(nama, '') <> '' order by nama`,
  ]);
  return { platforms: platforms.map((row) => row.nama), categories: categories.map((row) => row.nama) };
}

async function existing(sql: Sql, lock: boolean): Promise<ExistingPainPoint[]> {
  const rows = lock
    ? await sql<Array<Record<string, unknown>>>`select id, komentar, platform, kategori, username, bulan, source_url, notes, labels from pain_points for update`
    : await sql<Array<Record<string, unknown>>>`select id, komentar, platform, kategori, username, bulan, source_url, notes, labels from pain_points`;
  const text = (value: unknown) => (value === null || value === undefined ? "" : String(value));
  return rows.map((row) => ({ id: String(row.id), komentar: text(row.komentar), platform: text(row.platform), kategori: text(row.kategori), username: text(row.username), bulan: text(row.bulan), source_url: text(row.source_url), notes: text(row.notes), labels: labelList(row.labels) }));
}

/** labels is jsonb in some databases and text[] or text in others; write what the column holds. */
async function labelWriter(sql: Sql) {
  const [column] = await sql<Array<{ data_type: string }>>`select data_type from information_schema.columns where table_schema = 'public' and table_name = 'pain_points' and column_name = 'labels'`;
  const type = column?.data_type || "jsonb";
  return (labels: string[]) => (type === "ARRAY" ? labels : type === "jsonb" || type === "json" ? sql.json(labels) : JSON.stringify(labels));
}

async function plan(sql: Sql, raws: unknown[], lock: boolean) {
  const lists = await painPointLists(sql);
  const items = planPainPoints(raws, await existing(sql, lock), lists.platforms, lists.categories);
  return { items, summary: summarisePainPoints(items), ...lists };
}

export function previewPainPoints(raws: unknown[]) {
  return withPostgres((sql) => plan(sql, raws, false));
}

export function applyPainPoints(raws: unknown[], actor: string) {
  return withPostgres((sql) => sql.begin(async (tx) => {
    const result = await plan(tx, raws, true);
    const labels = await labelWriter(tx);
    for (const item of result.items) {
      if (item.action === "add") {
        const [row] = await tx<Array<{ id: string }>>`insert into pain_points ${tx({ ...item.set, labels: labels(item.labels) as never, added_via: actor, added_at: new Date() })} returning id`;
        item.id = String(row.id);
      } else if (item.action === "update") {
        // Empty fields only (checked again here, so a person's edit is never overwritten).
        for (const [field, value] of Object.entries(item.set)) await tx`update pain_points set ${tx(field)} = ${value} where id = ${item.id!} and coalesce(${tx(field)}, '') = ''`;
        if (item.addLabels.length) await tx`update pain_points set labels = ${labels(item.labels) as never} where id = ${item.id!}`;
      }
    }
    return result;
  }));
}
