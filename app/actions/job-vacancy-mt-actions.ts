"use server";

import { auth } from "@/auth";
import { logActivity } from "@/lib/api/activity";
import {
  createMtIndustry,
  createMtVacancy,
  deleteMtIndustry,
  deleteMtVacancy,
  importMtVacancies,
  listMtIndustries,
  listMtVacancies,
  updateMtVacancy,
} from "@/lib/api/job-vacancy-mt";
import { revalidatePath } from "next/cache";

async function actor() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.name || session.user.email || "CCC User";
}

function refresh() {
  revalidatePath("/job-vacancy-mt");
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanDate(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function cleanArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function cleanMonths(value: unknown) {
  const months = Array.isArray(value) ? value.map((item) => Number(item)) : [];
  return [...new Set(months.filter((month) => Number.isInteger(month) && month >= 1 && month <= 12))].sort((a, b) => a - b);
}

export type VacancyInput = {
  company: string;
  industry: string;
  program: string;
  roles: string[];
  edu?: string;
  gpa?: string;
  majors: string[];
  placement: string[];
  other_req?: string;
  duration?: string;
  selection: string[];
  months: number[];
  year: string;
  open_date?: string | null;
  deadline?: string | null;
  career_links: string[];
  ref_links: string[];
  notes?: string;
  status?: string;
};

function vacancyValues(input: VacancyInput) {
  const company = cleanText(input.company);
  const industry = cleanText(input.industry);
  const program = cleanText(input.program);
  if (!company || !industry || !program) throw new Error("Isi dulu: Nama Perusahaan, Industri, dan Nama Program!");
  const months = cleanMonths(input.months);
  if (!months.length) throw new Error("Pilih minimal 1 bulan buka!");
  const careerLinks = cleanArray(input.career_links);
  if (!careerLinks.length) throw new Error("Isi minimal 1 Career Platform Link!");
  return {
    company, industry, program,
    roles: cleanArray(input.roles),
    edu: cleanText(input.edu),
    gpa: cleanText(input.gpa),
    majors: cleanArray(input.majors),
    placement: cleanArray(input.placement),
    other_req: cleanText(input.other_req),
    duration: cleanText(input.duration),
    selection: cleanArray(input.selection),
    months,
    year: cleanText(input.year) || String(new Date().getFullYear()),
    open_date: cleanDate(input.open_date),
    deadline: cleanDate(input.deadline),
    career_links: careerLinks,
    ref_links: cleanArray(input.ref_links),
    notes: cleanText(input.notes),
    status: cleanText(input.status) || "Active",
  };
}

/* ── Vacancies ── */

export async function createVacancyAction(input: VacancyInput) {
  const name = await actor();
  const values = vacancyValues(input);
  await createMtVacancy(values);
  await logActivity({ userName: name, module: "MT Vacancies", action: "Tambah", detail: `${values.company} - ${values.program}`, table: "mt_vacancies" });
  refresh();
}

export async function updateVacancyAction(id: string, input: VacancyInput) {
  const name = await actor();
  const values = vacancyValues(input);
  await updateMtVacancy(id, values);
  await logActivity({ userName: name, module: "MT Vacancies", action: "Update", detail: `${values.company} - ${values.program}`, table: "mt_vacancies" });
  refresh();
}

export async function deleteVacancyAction(id: string) {
  const name = await actor();
  await deleteMtVacancy(id);
  await logActivity({ userName: name, module: "MT Vacancies", action: "Hapus", detail: `ID: ${id}`, table: "mt_vacancies" });
  refresh();
}

/* ── Industries (Master Data) ── */

export async function createIndustryAction(nama: string) {
  const name = await actor();
  const trimmed = nama.trim();
  if (!trimmed) return;
  const existing = await listMtIndustries();
  if (existing.some((row) => String(row.nama).toLowerCase() === trimmed.toLowerCase())) throw new Error("Industri sudah ada!");
  await createMtIndustry({ nama: trimmed });
  await logActivity({ userName: name, module: "MT Vacancies", action: "Tambah", detail: trimmed, table: "mt_industries" });
  refresh();
}

export async function deleteIndustryAction(id: string, nama: string) {
  const name = await actor();
  const vacancies = await listMtVacancies();
  if (vacancies.some((row) => row.industry === nama)) throw new Error("Tidak bisa dihapus — industri ini masih dipakai oleh beberapa loker.");
  await deleteMtIndustry(id);
  await logActivity({ userName: name, module: "MT Vacancies", action: "Hapus", detail: nama, table: "mt_industries" });
  refresh();
}

/* ── Sheets import (client parses CSV, this batches the upsert) ── */

export async function importVacanciesFromSheetAction(rows: Array<Record<string, unknown>>) {
  await actor();
  const result = await importMtVacancies(rows);
  refresh();
  return result;
}
