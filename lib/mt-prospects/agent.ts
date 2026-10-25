// Job Vacancy MT through the Claude access API: research Claude found or was given is added
// company by company, never as a full replacement (that stays the Excel upload's job).
//
// Rules (one place, used by preview and apply):
//   - A company is matched by name the same way the Excel upload matches research rows.
//     One clear match → update; no match → new (source 'manual', so a later Excel upload
//     keeps it); a similar but not identical name → "possible duplicate", left alone until the
//     caller says which company it is (match_id) or that it is new (as_new).
//   - Updates only fill what is empty. A different value for something already filled is
//     reported as a conflict and kept as it is. Opening years not there yet are added,
//     HR contacts not there yet are added, dated research notes are added (never duplicated).
//   - Nothing is ever deleted.
// Pure: tested under `node --test`.

import { normalizeName, nameVariants, parseMonths, type Opening, type ProspectStatus } from "./parse.ts";
import { editDistance } from "../search/synonyms.ts";

export const MAX_COMPANIES = 200;
const STATUSES: ProspectStatus[] = ["active", "predicted", "older", "excluded"];
const TEXT_FIELDS = ["legal_name", "industry", "program", "active_years", "notes"] as const;
type TextField = (typeof TEXT_FIELDS)[number];

export type AgentNote = { kind: "update" | "requirement" | "steps"; date: string; text: string; program: string; source_url: string };
export type AgentContact = { name: string; title: string; link: string };
export type AgentCompany = {
  brand: string; legal_name: string; industry: string; program: string; status: ProspectStatus | ""; active_years: string; notes: string;
  usual_months: number[]; openings: Record<string, Opening>; contacts: AgentContact[]; notesToAdd: AgentNote[];
  match_id: string; as_new: boolean;
};
export type ExistingCompany = {
  id: string; brand: string; legal_name: string; industry: string; program: string; status: ProspectStatus; active_years: string; notes: string;
  usual_months: number[]; openings: Record<string, Opening>; contactNames: string[]; noteTexts: string[];
};
export type PlanItem = {
  index: number;
  name: string;
  action: "add" | "update" | "no_change" | "possible_duplicate" | "invalid";
  id?: string;
  set: Partial<Record<TextField | "brand" | "status" | "usual_months", unknown>>;
  addOpenings: Record<string, Opening>;
  addContacts: AgentContact[];
  addNotes: AgentNote[];
  conflicts: Array<{ field: string; current: string; proposed: string }>;
  candidates: Array<{ id: string; name: string }>;
  errors: string[];
};

const text = (value: unknown, max = 400) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : typeof value === "number" ? String(value) : "");
const longText = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 4000) : "");
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const url = (value: unknown) => { const t = text(value, 500); return /^https?:\/\//i.test(t) ? t : ""; };

function months(value: unknown): number[] {
  if (Array.isArray(value)) return [...new Set(value.map(Number).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12))].sort((a, b) => a - b);
  return typeof value === "string" ? parseMonths(value) : [];
}

/** Checks one company from the request; problems are listed, nothing is guessed. */
export function readCompany(raw: unknown): { company: AgentCompany; errors: string[] } {
  const body = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const errors: string[] = [];
  const brand = text(body.brand, 160); const legal = text(body.legal_name, 200);
  if (!brand && !legal) errors.push("brand or legal_name is required");
  const status = text(body.status, 20).toLowerCase();
  if (status && !STATUSES.includes(status as ProspectStatus)) errors.push(`status must be one of ${STATUSES.join(", ")}`);
  const openings: Record<string, Opening> = {};
  if (body.openings && typeof body.openings === "object" && !Array.isArray(body.openings)) {
    for (const [year, value] of Object.entries(body.openings as Record<string, unknown>)) {
      if (!/^20\d\d$/.test(year)) { errors.push(`openings: "${year}" is not a year`); continue; }
      const item: Record<string, unknown> = value && typeof value === "object" ? (value as Record<string, unknown>) : { label: value };
      const label = text(item.label ?? item.months, 120);
      openings[year] = { months: months(item.months ?? item.label), label, dates: text(item.dates, 200) };
    }
  }
  const contacts = (Array.isArray(body.contacts) ? body.contacts : []).slice(0, 30).map((c) => {
    const item: Record<string, unknown> = c && typeof c === "object" ? (c as Record<string, unknown>) : {};
    return { name: text(item.name, 120), title: text(item.title, 160), link: url(item.link) || text(item.link, 300) };
  }).filter((c) => c.name);
  const notesToAdd: AgentNote[] = [];
  for (const [kind, list] of [["update", body.updates], ["requirement", body.requirements], ["steps", body.selection_steps]] as const) {
    for (const n of (Array.isArray(list) ? list : []).slice(0, 30)) {
      const item: Record<string, unknown> = n && typeof n === "object" ? (n as Record<string, unknown>) : { text: n };
      const noteText = longText(item.text);
      const date = text(item.date, 10);
      if (!noteText) continue;
      if (date && !isDate(date)) errors.push(`${kind === "steps" ? "selection_steps" : `${kind}s`}: date "${date}" must be YYYY-MM-DD`);
      notesToAdd.push({ kind, date: isDate(date) ? date : "", text: noteText, program: text(item.program, 160), source_url: url(item.source_url) });
    }
  }
  return {
    company: {
      brand, legal_name: legal, industry: text(body.industry, 120), program: text(body.program, 300), status: status as ProspectStatus | "",
      active_years: text(body.active_years, 60), notes: longText(body.notes), usual_months: months(body.usual_months), openings, contacts, notesToAdd,
      match_id: text(body.match_id, 40), as_new: body.as_new === true,
    },
    errors,
  };
}

const display = (row: { brand: string; legal_name: string }) => row.brand || row.legal_name;
const variantsOf = (row: { brand: string; legal_name: string }) => new Set([...nameVariants(row.brand), ...nameVariants(row.legal_name)]);

/** Similar but not the same name: one typo-level difference, or one name inside the other. */
/** A close but different name (one inside the other, or 1–2 letters off). Shared with Competitor Intel. */
export function similar(a: string, b: string) {
  if (!a || !b || a === b) return false;
  if (Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a))) return true;
  return Math.min(a.length, b.length) >= 5 && editDistance(a, b, 2) <= 2;
}

export function planCompanies(rawCompanies: unknown[], existing: ExistingCompany[]): PlanItem[] {
  const byId = new Map(existing.map((row) => [row.id, row]));
  return rawCompanies.slice(0, MAX_COMPANIES).map((raw, index) => {
    const { company, errors } = readCompany(raw);
    const item: PlanItem = { index, name: display(company) || `#${index + 1}`, action: "add", set: {}, addOpenings: {}, addContacts: [], addNotes: [], conflicts: [], candidates: [], errors };
    if (errors.length) return { ...item, action: "invalid" };
    let target: ExistingCompany | undefined;
    if (company.match_id) {
      target = byId.get(company.match_id);
      if (!target) return { ...item, action: "invalid", errors: [`match_id ${company.match_id} is not a company in Job Vacancy MT`] };
    } else if (!company.as_new) {
      const mine = variantsOf(company);
      const exact = existing.filter((row) => [...variantsOf(row)].some((variant) => mine.has(variant)));
      if (exact.length === 1) target = exact[0];
      else if (exact.length > 1) return { ...item, action: "possible_duplicate", candidates: exact.map((row) => ({ id: row.id, name: display(row) })) };
      else {
        const mainName = normalizeName(company.brand || company.legal_name);
        const close = existing.filter((row) => [normalizeName(row.brand), normalizeName(row.legal_name)].some((name) => similar(name, mainName)));
        if (close.length) return { ...item, action: "possible_duplicate", candidates: close.slice(0, 5).map((row) => ({ id: row.id, name: display(row) })) };
      }
    }
    if (!target) {
      // New company: everything given goes in.
      return { ...item, action: "add", set: { legal_name: company.legal_name, industry: company.industry, program: company.program, active_years: company.active_years, notes: company.notes, status: company.status || "active", usual_months: company.usual_months, brand: company.brand },
        addOpenings: company.openings, addContacts: company.contacts, addNotes: company.notesToAdd };
    }
    item.id = target.id; item.name = display(target);
    for (const field of TEXT_FIELDS) {
      const proposed = company[field];
      if (!proposed) continue;
      if (!target[field]) item.set[field] = proposed;
      else if (normalizeName(target[field]) !== normalizeName(proposed)) item.conflicts.push({ field, current: target[field], proposed });
    }
    if (company.status && company.status !== target.status) item.conflicts.push({ field: "status", current: target.status, proposed: company.status });
    if (company.usual_months.length) {
      if (!target.usual_months.length) item.set.usual_months = company.usual_months;
      else if (company.usual_months.join() !== [...target.usual_months].sort((a, b) => a - b).join()) item.conflicts.push({ field: "usual_months", current: target.usual_months.join(", "), proposed: company.usual_months.join(", ") });
    }
    for (const [year, opening] of Object.entries(company.openings)) if (!target.openings[year]) item.addOpenings[year] = opening;
    const knownContacts = new Set(target.contactNames.map(normalizeName));
    item.addContacts = company.contacts.filter((contact) => !knownContacts.has(normalizeName(contact.name)));
    const knownNotes = new Set(target.noteTexts.map(normalizeName));
    item.addNotes = company.notesToAdd.filter((note) => !knownNotes.has(normalizeName(note.text)));
    const changed = Object.keys(item.set).length || Object.keys(item.addOpenings).length || item.addContacts.length || item.addNotes.length;
    return { ...item, action: changed ? "update" : "no_change" };
  });
}

export function summarisePlan(items: PlanItem[]) {
  const count = (action: PlanItem["action"]) => items.filter((item) => item.action === action).length;
  return {
    added: count("add"), updated: count("update"), unchanged: count("no_change"), possibleDuplicates: count("possible_duplicate"), invalid: count("invalid"),
    contactsAdded: items.reduce((total, item) => total + (["add", "update"].includes(item.action) ? item.addContacts.length : 0), 0),
    notesAdded: items.reduce((total, item) => total + (["add", "update"].includes(item.action) ? item.addNotes.length : 0), 0),
    conflicts: items.reduce((total, item) => total + item.conflicts.length, 0),
  };
}
