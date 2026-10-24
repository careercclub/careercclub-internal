"use server";

import { auth } from "@/auth";
import { logActivity } from "@/lib/api/activity";
import {
  createProspect,
  createProspectContact,
  deleteProspect,
  deleteProspectContact,
  getProspectName,
  listProspectResearch,
  updateProspect,
  updateProspectContact,
  type ContactInput,
  type ProspectInput,
} from "@/lib/api/mt-prospects";
import { STATUSES, type ProspectStatus } from "@/lib/mt-prospects/view";
import { revalidatePath } from "next/cache";

const MODULE = "Job Vacancy MT";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function actor() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.name || session.user.email || "CCC User";
}

const refresh = () => revalidatePath("/job-vacancy-mt");
const text = (value: unknown, max = 4000) => (typeof value === "string" ? value.trim().slice(0, max) : "");
function id(value: unknown) { const textValue = text(value, 64); if (!UUID.test(textValue)) throw new Error("That record could not be found."); return textValue; }
function months(value: unknown) {
  const list = Array.isArray(value) ? value.map(Number) : [];
  return [...new Set(list.filter((month) => Number.isInteger(month) && month >= 1 && month <= 12))].sort((a, b) => a - b);
}

function cleanProspect(raw: Record<string, unknown>): ProspectInput {
  const status = STATUSES.includes(raw.status as ProspectStatus) ? (raw.status as ProspectStatus) : null;
  const input = {
    legal_name: text(raw.legal_name, 300), brand: text(raw.brand, 300), industry: text(raw.industry, 120), program: text(raw.program),
    active_years: text(raw.active_years, 40), notes: text(raw.notes), exclusion_reason: text(raw.exclusion_reason),
  };
  const missing = [["brand", "Brand"], ["legal_name", "Legal name"], ["industry", "Industry"], ["program", "Programme"]].filter(([key]) => !input[key as keyof typeof input]).map(([, label]) => label);
  if (!status) missing.push("Status");
  if (missing.length) throw new Error(`Fill in ${missing.join(", ")}.`);
  const total = Number(raw.total_openings);
  const openings: ProspectInput["openings"] = {};
  const rawOpenings = raw.openings && typeof raw.openings === "object" ? (raw.openings as Record<string, Record<string, unknown>>) : {};
  for (const [year, value] of Object.entries(rawOpenings)) {
    if (!/^\d{4}$/.test(year) || !value) continue;
    const opening = { months: months(value.months), label: text(value.label, 200), dates: text(value.dates, 1000) };
    if (opening.months.length || opening.label || opening.dates) openings[year] = opening;
  }
  const rawPrediction = raw.prediction && typeof raw.prediction === "object" ? (raw.prediction as Record<string, unknown>) : null;
  const prediction = rawPrediction ? Object.fromEntries(Object.entries(rawPrediction).map(([key, value]) => [key, text(value, 1000)]).filter(([, value]) => value)) : null;
  return {
    ...input, status: status as ProspectStatus,
    total_openings: Number.isInteger(total) && total >= 0 ? total : null,
    usual_months: months(raw.usual_months), openings,
    prediction: prediction && Object.keys(prediction).length ? prediction : null,
  };
}

function cleanContact(raw: Record<string, unknown>): ContactInput {
  const input = { name: text(raw.name, 200), title: text(raw.title, 300), link: text(raw.link, 500) };
  const missing = [["name", "Name"], ["title", "Job title"], ["link", "LinkedIn or email"]].filter(([key]) => !input[key as keyof ContactInput]).map(([, label]) => label);
  if (missing.length) throw new Error(`Fill in ${missing.join(", ")}.`);
  return input;
}

export async function saveProspectAction(prospectId: string | null, raw: Record<string, unknown>) {
  const name = await actor();
  const input = cleanProspect(raw);
  const label = input.brand || input.legal_name;
  if (prospectId) {
    await updateProspect(id(prospectId), input);
    await logActivity({ userName: name, module: MODULE, action: "Update", detail: label, table: "mt_prospects" });
    refresh();
    return { id: prospectId };
  }
  const created = await createProspect(input);
  await logActivity({ userName: name, module: MODULE, action: "Tambah", detail: label, table: "mt_prospects" });
  refresh();
  return { id: created };
}

export async function deleteProspectAction(prospectId: string) {
  const name = await actor();
  const target = id(prospectId);
  const label = await getProspectName(target);
  await deleteProspect(target);
  await logActivity({ userName: name, module: MODULE, action: "Hapus", detail: label, table: "mt_prospects" });
  refresh();
}

export async function saveProspectContactAction(prospectId: string, contactId: string | null, raw: Record<string, unknown>) {
  const name = await actor();
  const input = cleanContact(raw);
  if (contactId) await updateProspectContact(id(contactId), input);
  else await createProspectContact(id(prospectId), input);
  await logActivity({ userName: name, module: MODULE, action: contactId ? "Update" : "Tambah", detail: `Contact ${input.name} · ${await getProspectName(id(prospectId))}`, table: "mt_prospect_contacts" });
  refresh();
}

export async function deleteProspectContactAction(contactId: string, contactName: string) {
  const name = await actor();
  await deleteProspectContact(id(contactId));
  await logActivity({ userName: name, module: MODULE, action: "Hapus", detail: `Contact ${text(contactName, 120)}`, table: "mt_prospect_contacts" });
  refresh();
}

/** Requirements, status updates and selection steps for one company, loaded when its detail opens. */
export async function loadProspectResearchAction(prospectId: string) {
  await actor();
  return listProspectResearch(id(prospectId));
}
