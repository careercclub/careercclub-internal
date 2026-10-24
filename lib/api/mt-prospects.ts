import "server-only";
import { withPostgres } from "@/lib/db/postgres";
import type postgres from "postgres";
import type { ParseResult } from "@/lib/mt-prospects/parse";
import { displayName, type ContactRow, type ProspectRow, type ProspectStatus } from "@/lib/mt-prospects/view";

// Job Vacancy MT data: companies (mt_prospects), their HR contacts, research rows and
// the upload history. Workbook rows carry source = 'import' and an import_key; rows
// added in the app carry source = 'manual' and are never touched by an upload.

export type ResearchRow = { id: string; kind: "requirement" | "update" | "steps"; program: string; origin: string; ref_id: string; details: Record<string, string> };
export type ImportSummary = {
  /** removed: no longer in the file. keptForAppContacts: no longer in the file but holding contacts added in the app, so kept as app companies. */
  companies: { added: number; updated: number; removed: number; keptForAppContacts: number; keptFromApp: number };
  contacts: number;
  research: { requirement: number; update: number; steps: number };
  unmatched: ParseResult["unmatched"];
  skippedNotes: number;
  /** Companies added in the app whose name also appears in the file (would show twice). */
  sameNameAsApp: string[];
};
export type ImportInfo = { file_name: string; imported_by: string; created_at: string; summary: ImportSummary } | null;

export type ProspectInput = {
  legal_name: string; brand: string; status: ProspectStatus; industry: string; program: string;
  active_years: string; total_openings: number | null; usual_months: number[];
  openings: ProspectRow["openings"]; prediction: ProspectRow["prediction"]; notes: string; exclusion_reason: string;
};
export type ContactInput = { name: string; title: string; link: string };

const PROSPECT_FIELDS = "id, legal_name, brand, status, industry, program, active_years, total_openings, usual_months, openings, prediction, notes, exclusion_reason, source";

export function listProspects() {
  return withPostgres(async (sql) => {
    const rows = await sql.unsafe<ProspectRow[]>(`select ${PROSPECT_FIELDS} from mt_prospects order by lower(coalesce(nullif(brand, ''), legal_name))`);
    return rows.map((row) => ({ ...row, id: String(row.id), usual_months: (row.usual_months || []).map(Number), openings: row.openings || {} }));
  });
}

export function listProspectContacts() {
  return withPostgres(async (sql) => {
    const rows = await sql<ContactRow[]>`select id, prospect_id, name, title, link, mt_status, source from mt_prospect_contacts order by prospect_id, position, lower(name)`;
    return rows.map((row) => ({ ...row, id: String(row.id), prospect_id: String(row.prospect_id) }));
  });
}

export function listProspectResearch(prospectId: string) {
  return withPostgres(async (sql) => {
    const rows = await sql<ResearchRow[]>`select id, kind, program, origin, ref_id, details from mt_prospect_research where prospect_id = ${prospectId} order by kind, position`;
    return rows.map((row) => ({ ...row, id: String(row.id), details: row.details || {} }));
  });
}

export function latestProspectImport(): Promise<ImportInfo> {
  return withPostgres(async (sql) => {
    const [row] = await sql<Array<{ file_name: string; imported_by: string; created_at: Date; summary: ImportSummary }>>`select file_name, imported_by, created_at, summary from mt_prospect_imports order by created_at desc limit 1`;
    return row ? { ...row, created_at: new Date(row.created_at).toISOString() } : null;
  });
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** What an upload would change, without changing anything. */
export function previewProspectImport(parsed: ParseResult): Promise<ImportSummary> {
  return withPostgres(async (sql) => {
    return summarise(parsed, await existingRows(sql));
  });
}

type Existing = { import_key: string | null; brand: string; legal_name: string; has_app_contacts: boolean };
function existingRows(sql: postgres.Sql | postgres.TransactionSql) {
  return sql<Existing[]>`
    select p.import_key, p.brand, p.legal_name,
      exists (select 1 from mt_prospect_contacts c where c.prospect_id = p.id and c.source = 'manual') as has_app_contacts
    from mt_prospects p`;
}

function summarise(parsed: ParseResult, existing: Existing[]): ImportSummary {
  const keys = new Set(parsed.prospects.map((item) => item.importKey));
  const imported = existing.filter((row) => row.import_key);
  const importedKeys = new Set(imported.map((row) => row.import_key));
  const manual = existing.filter((row) => !row.import_key);
  const fileNames = parsed.prospects.map((item) => displayName({ brand: item.brand, legal_name: item.legalName }));
  return {
    companies: {
      added: parsed.prospects.filter((item) => !importedKeys.has(item.importKey)).length,
      updated: parsed.prospects.filter((item) => importedKeys.has(item.importKey)).length,
      removed: imported.filter((row) => !keys.has(String(row.import_key)) && !row.has_app_contacts).length,
      keptForAppContacts: imported.filter((row) => !keys.has(String(row.import_key)) && row.has_app_contacts).length,
      keptFromApp: manual.length,
    },
    contacts: parsed.contacts.length,
    research: {
      requirement: parsed.research.filter((item) => item.kind === "requirement").length,
      update: parsed.research.filter((item) => item.kind === "update").length,
      steps: parsed.research.filter((item) => item.kind === "steps").length,
    },
    unmatched: parsed.unmatched,
    skippedNotes: parsed.skippedNotes,
    sameNameAsApp: manual.map((row) => displayName(row)).filter((name) => fileNames.some((other) => sameName(name, other))),
  };
}

/**
 * Applies an upload in one transaction: workbook companies are updated in place by
 * import_key, new ones added, ones no longer in the file removed; their imported
 * contacts and all research rows are replaced. App-added companies and contacts stay.
 */
export function applyProspectImport(parsed: ParseResult, meta: { fileName: string; importedBy: string }) {
  return withPostgres((sql) => sql.begin(async (tx) => {
    const summary = summarise(parsed, await existingRows(tx));
    const prospects = parsed.prospects.map((item) => ({
      import_key: item.importKey, legal_name: item.legalName, brand: item.brand, status: item.status, industry: item.industry, program: item.program,
      active_years: item.activeYears, total_openings: item.totalOpenings, usual_months: item.usualMonths, openings: item.openings, prediction: item.prediction,
      notes: item.notes, exclusion_reason: item.exclusionReason,
    }));
    const keys = prospects.map((item) => item.import_key);
    // A company gone from the file but holding contacts added in the app becomes an app company
    // (kept, with those contacts); the rest are removed with their imported rows.
    await tx`
      update mt_prospects p set import_key = null, source = 'manual', updated_at = now()
      where p.import_key is not null and not (p.import_key = any(${keys}::text[]))
        and exists (select 1 from mt_prospect_contacts c where c.prospect_id = p.id and c.source = 'manual')`;
    await tx`delete from mt_prospects where import_key is not null and not (import_key = any(${keys}::text[]))`;
    if (prospects.length) {
      await tx`
        insert into mt_prospects (import_key, legal_name, brand, status, industry, program, active_years, total_openings, usual_months, openings, prediction, notes, exclusion_reason, source, imported_at)
        select x.import_key, x.legal_name, x.brand, x.status, x.industry, x.program, x.active_years, x.total_openings,
               coalesce(array(select jsonb_array_elements_text(x.usual_months)::int), '{}'), coalesce(x.openings, '{}'::jsonb), x.prediction, x.notes, x.exclusion_reason, 'import', now()
        from jsonb_to_recordset(${tx.json(prospects as never)}) as x(import_key text, legal_name text, brand text, status text, industry text, program text, active_years text, total_openings integer, usual_months jsonb, openings jsonb, prediction jsonb, notes text, exclusion_reason text)
        on conflict (import_key) do update set
          legal_name = excluded.legal_name, brand = excluded.brand, status = excluded.status, industry = excluded.industry, program = excluded.program,
          active_years = excluded.active_years, total_openings = excluded.total_openings, usual_months = excluded.usual_months, openings = excluded.openings,
          prediction = excluded.prediction, notes = excluded.notes, exclusion_reason = excluded.exclusion_reason, source = 'import', imported_at = now(), updated_at = now()`;
    }
    await tx`delete from mt_prospect_contacts where source = 'import'`;
    await tx`delete from mt_prospect_research`;
    if (parsed.contacts.length) {
      const contacts = parsed.contacts.map((item) => ({ import_key: item.importKey, name: item.name, title: item.title, link: item.link, mt_status: item.mtStatus, position: item.position }));
      await tx`
        insert into mt_prospect_contacts (prospect_id, name, title, link, mt_status, source, position)
        select p.id, x.name, x.title, x.link, x.mt_status, 'import', x.position
        from jsonb_to_recordset(${tx.json(contacts as never)}) as x(import_key text, name text, title text, link text, mt_status text, position integer)
        join mt_prospects p on p.import_key = x.import_key`;
    }
    if (parsed.research.length) {
      const research = parsed.research.map((item) => ({ import_key: item.importKey, kind: item.kind, program: item.program, origin: item.origin, ref_id: item.refId, details: item.details, position: item.position }));
      await tx`
        insert into mt_prospect_research (prospect_id, kind, program, origin, ref_id, details, position)
        select p.id, x.kind, x.program, x.origin, x.ref_id, coalesce(x.details, '{}'::jsonb), x.position
        from jsonb_to_recordset(${tx.json(research as never)}) as x(import_key text, kind text, program text, origin text, ref_id text, details jsonb, position integer)
        join mt_prospects p on p.import_key = x.import_key`;
    }
    await tx`insert into mt_prospect_imports (file_name, imported_by, summary) values (${meta.fileName}, ${meta.importedBy}, ${tx.json(summary as never)})`;
    return summary;
  }));
}

/* ── Edits in the app ── */

function prospectValues(input: ProspectInput) {
  return {
    legal_name: input.legal_name, brand: input.brand, status: input.status, industry: input.industry, program: input.program,
    active_years: input.active_years, total_openings: input.total_openings, notes: input.notes, exclusion_reason: input.exclusion_reason,
  };
}

export function createProspect(input: ProspectInput) {
  return withPostgres(async (sql) => {
    const v = prospectValues(input);
    const [row] = await sql<Array<{ id: string }>>`
      insert into mt_prospects (legal_name, brand, status, industry, program, active_years, total_openings, notes, exclusion_reason, usual_months, openings, prediction, source)
      values (${v.legal_name}, ${v.brand}, ${v.status}, ${v.industry}, ${v.program}, ${v.active_years}, ${v.total_openings}, ${v.notes}, ${v.exclusion_reason},
        ${input.usual_months}::int[], ${sql.json(input.openings as never)}, ${input.prediction ? sql.json(input.prediction as never) : null}, 'manual')
      returning id`;
    return String(row.id);
  });
}

export function updateProspect(id: string, input: ProspectInput) {
  return withPostgres(async (sql) => {
    const rows = await sql`
      update mt_prospects set ${sql(prospectValues(input))}, usual_months = ${input.usual_months}::int[], openings = ${sql.json(input.openings as never)},
        prediction = ${input.prediction ? sql.json(input.prediction as never) : null}, updated_at = now()
      where id = ${id} returning id`;
    if (!rows.length) throw new Error("That company no longer exists. It may have been removed by an upload.");
  });
}

export function deleteProspect(id: string) {
  return withPostgres(async (sql) => { await sql`delete from mt_prospects where id = ${id}`; });
}

export function getProspectName(id: string) {
  return withPostgres(async (sql) => {
    const [row] = await sql<Array<{ brand: string; legal_name: string }>>`select brand, legal_name from mt_prospects where id = ${id}`;
    return row ? displayName(row) : "";
  });
}

export function createProspectContact(prospectId: string, input: ContactInput) {
  return withPostgres(async (sql) => {
    const [row] = await sql<Array<{ id: string }>>`
      insert into mt_prospect_contacts (prospect_id, name, title, link, source, position)
      values (${prospectId}, ${input.name}, ${input.title}, ${input.link}, 'manual', coalesce((select max(position) + 1 from mt_prospect_contacts where prospect_id = ${prospectId}), 0))
      returning id`;
    return String(row.id);
  });
}

export function updateProspectContact(id: string, input: ContactInput) {
  return withPostgres(async (sql) => {
    const rows = await sql`update mt_prospect_contacts set name = ${input.name}, title = ${input.title}, link = ${input.link}, updated_at = now() where id = ${id} returning id`;
    if (!rows.length) throw new Error("That contact no longer exists. It may have been replaced by an upload.");
  });
}

export function deleteProspectContact(id: string) {
  return withPostgres(async (sql) => { await sql`delete from mt_prospect_contacts where id = ${id}`; });
}
