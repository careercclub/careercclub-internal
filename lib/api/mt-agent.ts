import "server-only";
import type postgres from "postgres";
import { withPostgres } from "@/lib/db/postgres";
import { planCompanies, summarisePlan, type ExistingCompany, type PlanItem } from "@/lib/mt-prospects/agent";

// Job Vacancy MT through the Claude access API (rules in lib/mt-prospects/agent.ts).
// Notes Claude adds are research rows with origin 'Claude'; an Excel upload keeps them.

type Sql = postgres.Sql | postgres.TransactionSql;

async function existingCompanies(sql: Sql): Promise<ExistingCompany[]> {
  const [prospects, contacts, notes] = await Promise.all([
    sql<Array<Omit<ExistingCompany, "contactNames" | "noteTexts">>>`select id, brand, legal_name, industry, program, status, active_years, notes, usual_months, openings from mt_prospects`,
    sql<Array<{ prospect_id: string; name: string }>>`select prospect_id, name from mt_prospect_contacts`,
    sql<Array<{ prospect_id: string; note: string | null }>>`select prospect_id, details->>'Note' as note from mt_prospect_research where origin = 'Claude'`,
  ]);
  const group = <T extends { prospect_id: string }>(rows: readonly T[], pick: (row: T) => string | null) => {
    const map = new Map<string, string[]>();
    for (const row of rows) { const value = pick(row); if (value) map.set(String(row.prospect_id), [...(map.get(String(row.prospect_id)) || []), value]); }
    return map;
  };
  const contactMap = group(contacts, (row) => row.name);
  const noteMap = group(notes, (row) => row.note);
  return prospects.map((row) => ({
    ...row, id: String(row.id), brand: row.brand || "", legal_name: row.legal_name || "", industry: row.industry || "", program: row.program || "", active_years: row.active_years || "", notes: row.notes || "",
    usual_months: (row.usual_months || []).map(Number), openings: row.openings || {}, contactNames: contactMap.get(String(row.id)) || [], noteTexts: noteMap.get(String(row.id)) || [],
  }));
}

export function previewAgentCompanies(companies: unknown[]) {
  return withPostgres(async (sql) => {
    const items = planCompanies(companies, await existingCompanies(sql));
    return { items, summary: summarisePlan(items) };
  });
}

/** Applies the plan in one transaction. Possible duplicates and invalid items are skipped. */
export function applyAgentCompanies(companies: unknown[], actor: string) {
  return withPostgres((sql) => sql.begin(async (tx) => {
    const items = planCompanies(companies, await existingCompanies(tx));
    for (const item of items) {
      if (item.action === "add") item.id = await insertCompany(tx, item);
      else if (item.action === "update") await updateCompany(tx, item);
      else continue;
      await addChildren(tx, item, actor);
    }
    return { items, summary: summarisePlan(items) };
  }));
}

async function insertCompany(tx: Sql, item: PlanItem) {
  const v = item.set as Record<string, unknown>;
  const [row] = await tx<Array<{ id: string }>>`
    insert into mt_prospects (legal_name, brand, status, industry, program, active_years, usual_months, openings, notes, source, added_via)
    values (${String(v.legal_name || "")}, ${String(v.brand || "")}, ${String(v.status || "active")}, ${String(v.industry || "")}, ${String(v.program || "")}, ${String(v.active_years || "")},
            ${(v.usual_months as number[]) || []}, ${tx.json(item.addOpenings as never)}, ${String(v.notes || "")}, 'manual', 'claude')
    returning id`;
  return String(row.id);
}

async function updateCompany(tx: Sql, item: PlanItem) {
  const v = item.set as Record<string, unknown>;
  // Each field only when it is still empty (checked again here, so a concurrent edit is never overwritten).
  for (const field of ["legal_name", "industry", "program", "active_years", "notes"] as const) {
    if (typeof v[field] === "string") await tx`update mt_prospects set ${tx(field)} = ${v[field] as string}, updated_at = now() where id = ${item.id!} and coalesce(${tx(field)}, '') = ''`;
  }
  if (Array.isArray(v.usual_months)) await tx`update mt_prospects set usual_months = ${v.usual_months as number[]}, updated_at = now() where id = ${item.id!} and cardinality(usual_months) = 0`;
  if (Object.keys(item.addOpenings).length) {
    // Years already there win (jsonb right-hand side): only missing years are added.
    await tx`update mt_prospects set openings = ${tx.json(item.addOpenings as never)}::jsonb || coalesce(openings, '{}'::jsonb), updated_at = now() where id = ${item.id!}`;
  }
}

async function addChildren(tx: Sql, item: PlanItem, actor: string) {
  for (const [position, contact] of item.addContacts.entries()) {
    await tx`insert into mt_prospect_contacts (prospect_id, name, title, link, mt_status, source, position, added_via) values (${item.id!}, ${contact.name}, ${contact.title}, ${contact.link}, '', 'manual', ${1000 + position}, 'claude')`;
  }
  for (const [position, note] of item.addNotes.entries()) {
    const details: Record<string, string> = { Date: note.date, Note: note.text, ...(note.program ? { Program: note.program } : {}), ...(note.source_url ? { Source: note.source_url } : {}), "Added by": actor };
    await tx`insert into mt_prospect_research (prospect_id, kind, program, origin, ref_id, details, position) values (${item.id!}, ${note.kind}, ${note.program}, 'Claude', '', ${tx.json(details as never)}, ${1000 + position})`;
  }
}
