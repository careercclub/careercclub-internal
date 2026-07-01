"use server";

import { auth } from "@/auth";
import { logActivity } from "@/lib/api/activity";
import {
  createCarouselCta,
  createCarouselPlan,
  createCarouselPlanLink,
  createKol,
  createMtStory,
  createStoryPlanItem,
  createStoryPlanLink,
  createStoryPlanWithItems,
  deleteCarouselPlan,
  deleteCarouselPlanLink,
  deleteKol,
  deleteMtStory,
  deleteStoryPlanDate,
  deleteStoryPlanItem,
  deleteStoryPlanLink,
  listStoryPlanItems,
  updateCarouselPlan,
  updateKol,
  updateMtStory,
  updateStoryPlanDate,
  updateStoryPlanItem,
} from "@/lib/api/content-planning";
import { revalidatePath } from "next/cache";

async function actor() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.name || session.user.email || "CCC User";
}

function refresh() {
  revalidatePath("/content-planning");
}

function cleanText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function cleanDate(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function cleanUrl(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  if (!/^https?:\/\//i.test(text)) throw new Error("URL must start with http:// or https://");
  return text;
}

/* ── Existing exports (kept — used by story-plan-ai-parser and sub-pages) ── */

export async function createStoryPlanFromTextAction(input: { tanggal: string; status?: string; items: Array<{ urutan?: number; isi?: string }> }) {
  const name = await actor();
  await createStoryPlanWithItems(input);
  await logActivity({ userName: name, module: "Story planner", action: "Tambah", detail: input.tanggal, table: "story_plan_dates" });
  refresh();
  revalidatePath("/content-planning/stories");
}

export async function addStorySlideAction(dateId: string, formData: FormData) {
  await actor();
  const content = String(formData.get("isi") || "").trim();
  const order = Number(formData.get("urutan") || 1);
  if (!content) throw new Error("Slide content is required.");
  await createStoryPlanItem({ date_id: dateId, isi: content, urutan: Number.isFinite(order) ? order : 1 });
  refresh();
}

export async function setStoryPlanStatusAction(dateId: string, status: "Draft" | "Done") {
  await actor();
  await updateStoryPlanDate(dateId, { status });
  refresh();
}

export async function addCarouselPlanLinkAction(planId: string, formData: FormData) {
  await actor();
  const label = String(formData.get("label") || "").trim();
  const url = String(formData.get("url") || "").trim();
  if (!label || !/^https?:\/\//i.test(url)) throw new Error("A label and valid URL are required.");
  await createCarouselPlanLink({ plan_id: planId, label, url });
  refresh();
}

/* ── Reusable Links panel (global, no plan_id) ── */

export async function addContentLinkAction(kind: "cp" | "sp", label: string, url: string) {
  await actor();
  const trimmedLabel = label.trim();
  const validUrl = cleanUrl(url);
  if (!trimmedLabel || !validUrl) throw new Error("A label and valid URL are required.");
  const row = kind === "cp"
    ? await createCarouselPlanLink({ label: trimmedLabel, url: validUrl })
    : await createStoryPlanLink({ label: trimmedLabel, url: validUrl });
  refresh();
  return { id: String(row.id), label: trimmedLabel, url: validUrl };
}

export async function deleteContentLinkAction(kind: "cp" | "sp", id: string) {
  await actor();
  if (kind === "cp") await deleteCarouselPlanLink(id);
  else await deleteStoryPlanLink(id);
  refresh();
}

/* ── Carousel plans ── */

export type CarouselPlanInput = {
  judul: string;
  tanggal_posting?: string | null;
  funnel?: string;
  cta?: string | null;
  assignee_id?: string | null;
  status?: string;
  link_brief?: string | null;
};

export async function createCarouselPlanAction(input: CarouselPlanInput) {
  const name = await actor();
  const judul = input.judul.trim();
  if (!judul) throw new Error("Judul wajib diisi.");
  await createCarouselPlan({
    judul,
    tanggal_posting: cleanDate(input.tanggal_posting),
    funnel: input.funnel || "TOFU",
    cta: cleanText(input.cta),
    assignee_id: cleanText(input.assignee_id),
    status: input.status === "Done" ? "Done" : "Draft",
    link_brief: cleanText(input.link_brief),
  });
  await logActivity({ userName: name, module: "Carousel planner", action: "Tambah", detail: judul, table: "carousel_plans" });
  refresh();
}

export async function updateCarouselPlanAction(id: string, input: CarouselPlanInput) {
  const name = await actor();
  const judul = input.judul.trim();
  if (!judul) throw new Error("Judul wajib diisi.");
  await updateCarouselPlan(id, {
    judul,
    tanggal_posting: cleanDate(input.tanggal_posting),
    funnel: input.funnel || "TOFU",
    cta: cleanText(input.cta),
    assignee_id: cleanText(input.assignee_id),
    status: input.status === "Done" ? "Done" : "Draft",
    link_brief: cleanText(input.link_brief),
  });
  await logActivity({ userName: name, module: "Carousel planner", action: "Update", detail: judul, table: "carousel_plans" });
  refresh();
}

export async function setCarouselStatusAction(id: string, status: "Draft" | "Done") {
  await actor();
  await updateCarouselPlan(id, { status: status === "Done" ? "Done" : "Draft" });
  refresh();
}

export async function setCarouselDateAction(id: string, tanggal: string) {
  await actor();
  await updateCarouselPlan(id, { tanggal_posting: cleanDate(tanggal) });
  refresh();
}

export async function setCarouselLinkBriefAction(id: string, url: string | null) {
  await actor();
  await updateCarouselPlan(id, { link_brief: url ? cleanUrl(url) : null });
  refresh();
}

export async function deleteCarouselPlanAction(id: string) {
  const name = await actor();
  await deleteCarouselPlan(id);
  await logActivity({ userName: name, module: "Carousel planner", action: "Hapus", detail: `ID: ${id}`, table: "carousel_plans" });
  refresh();
}

export async function createCtaAction(label: string) {
  await actor();
  const trimmed = label.trim();
  if (!trimmed) throw new Error("CTA label is required.");
  const row = await createCarouselCta({ label: trimmed });
  refresh();
  return { id: String(row.id), label: trimmed };
}

/* ── Story plan ── */

export async function createStoryDateAction(input: { tanggal: string; items: string[] }) {
  const name = await actor();
  const items = input.items.map((isi, index) => ({ urutan: index + 1, isi: isi.trim() })).filter((item) => item.isi);
  await createStoryPlanWithItems({ tanggal: input.tanggal, items });
  await logActivity({ userName: name, module: "Story planner", action: "Tambah", detail: input.tanggal, table: "story_plan_dates" });
  refresh();
}

export async function deleteStoryDateAction(id: string) {
  await actor();
  const items = await listStoryPlanItems({ eq: { date_id: id } });
  await Promise.all(items.map((item) => deleteStoryPlanItem(String(item.id))));
  await deleteStoryPlanDate(id);
  refresh();
}

export async function addStoryItemAction(dateId: string) {
  await actor();
  const items = await listStoryPlanItems({ eq: { date_id: dateId } });
  const row = await createStoryPlanItem({ date_id: dateId, urutan: items.length + 1, isi: "" });
  refresh();
  return String(row.id);
}

export async function updateStoryItemAction(id: string, isi: string) {
  await actor();
  await updateStoryPlanItem(id, { isi: isi.trim() });
  refresh();
}

export async function deleteStoryItemAction(id: string) {
  await actor();
  await deleteStoryPlanItem(id);
  refresh();
}

/* ── KOL directory ── */

export type KolInput = {
  nama: string;
  username?: string | null;
  platform?: string | null;
  niche?: string | null;
  followers?: number | null;
  contact?: string | null;
  rate_card_url?: string | null;
  foto_url?: string | null;
  notes?: string | null;
};

function kolValues(input: KolInput) {
  return {
    nama: input.nama.trim(),
    username: cleanText(input.username),
    platform: cleanText(input.platform),
    niche: cleanText(input.niche),
    followers: Number.isFinite(Number(input.followers)) ? Number(input.followers) : 0,
    contact: cleanText(input.contact),
    rate_card_url: cleanText(input.rate_card_url),
    foto_url: cleanText(input.foto_url),
    notes: cleanText(input.notes),
  };
}

export async function createKolAction(input: KolInput) {
  await actor();
  if (!input.nama.trim()) throw new Error("Nama KOL wajib diisi.");
  await createKol(kolValues(input));
  refresh();
}

export async function updateKolAction(id: string, input: KolInput) {
  await actor();
  if (!input.nama.trim()) throw new Error("Nama KOL wajib diisi.");
  await updateKol(id, kolValues(input));
  refresh();
}

export async function deleteKolAction(id: string) {
  await actor();
  await deleteKol(id);
  refresh();
}

/* ── MT Story ── */

export type MtStoryInput = {
  nama: string;
  perusahaan?: string | null;
  batch?: string | null;
  wa?: string | null;
  deskripsi?: string | null;
  ig_url?: string | null;
  linkedin_url?: string | null;
  brief_url?: string | null;
  foto_url?: string | null;
  is_posted?: boolean;
};

function mtValues(input: MtStoryInput) {
  return {
    nama: input.nama.trim(),
    perusahaan: cleanText(input.perusahaan),
    batch: cleanText(input.batch),
    wa: cleanText(input.wa),
    deskripsi: cleanText(input.deskripsi),
    ig_url: cleanText(input.ig_url),
    linkedin_url: cleanText(input.linkedin_url),
    brief_url: cleanText(input.brief_url),
    foto_url: cleanText(input.foto_url),
    is_posted: Boolean(input.is_posted),
    posted_at: input.is_posted ? new Date().toISOString() : null,
  };
}

export async function createMtStoryAction(input: MtStoryInput) {
  await actor();
  if (!input.nama.trim()) throw new Error("Nama wajib diisi.");
  await createMtStory(mtValues(input));
  refresh();
}

export async function updateMtStoryAction(id: string, input: MtStoryInput) {
  await actor();
  if (!input.nama.trim()) throw new Error("Nama wajib diisi.");
  await updateMtStory(id, mtValues(input));
  refresh();
}

export async function deleteMtStoryAction(id: string) {
  await actor();
  await deleteMtStory(id);
  refresh();
}

export async function setMtPostedAction(id: string, isPosted: boolean) {
  await actor();
  await updateMtStory(id, { is_posted: isPosted, posted_at: isPosted ? new Date().toISOString() : null });
  refresh();
}
