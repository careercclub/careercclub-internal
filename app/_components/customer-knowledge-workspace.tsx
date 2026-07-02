"use client";

import { createManagedRecord, deleteManagedRecord, updateManagedRecord } from "@/app/actions/record-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApiRecord } from "@/lib/api/_crud";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { DistributionChart, MonthlyOpenChart } from "./charts";
import { FilterBar, Pagination, Pill, StatCard, StatsGrid, filterFieldClass, usePagination } from "./ui-kit";

type Tab = "dashboard" | "database" | "freeclass";
type PillTone = "red" | "amber" | "green" | "blue" | "purple" | "gray" | "coral" | "pink" | "teal";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const stopwords = new Set(["yang", "dan", "di", "ke", "dari", "itu", "ini", "gak", "ga", "gue", "aku", "kak", "dong", "sih", "ya", "aja", "bgt", "banget", "kali", "udah", "mau", "bisa", "ada", "untuk", "dengan", "juga", "lebih", "tapi", "kalau", "karena", "gimana", "setelah", "pas", "waktu", "deh", "loh", "nih"]);
const whitelist = new Set(["mt", "hr", "hrd", "cv", "fgd", "oa", "ip"]);
const PLATFORM_ICONS: Record<string, string> = { tiktok: "ti-brand-tiktok", instagram: "ti-brand-instagram", youtube: "ti-brand-youtube", twitter: "ti-brand-x", x: "ti-brand-x", facebook: "ti-brand-facebook", threads: "ti-brand-threads" };
const LABEL_COLORS = [
  { bg: "#e8f0fc", color: "#0a3d8f" }, { bg: "#dcfce7", color: "#166534" },
  { bg: "#fef3c7", color: "#92400e" }, { bg: "#fee2e2", color: "#991b1b" },
  { bg: "#e0f2fe", color: "#075985" }, { bg: "#fce7f3", color: "#9d174d" },
  { bg: "#f3e8ff", color: "#6b21a8" }, { bg: "#ecfccb", color: "#365314" },
];
const VALID_TONES = new Set(["purple", "blue", "teal", "amber", "coral", "pink", "green", "red"]);
const RATING_FIELDS = [
  ["materi_judul", "Materi sesuai judul/tema webinar"],
  ["materi_kebutuhan", "Materi sesuai kebutuhan saya"],
  ["materi_mudah", "Materi mudah dipahami"],
  ["materi_jawab", "Materi menjawab pertanyaan saya"],
  ["nara_kuasai", "Narasumber menguasai materi"],
  ["nara_jelas", "Narasumber menyampaikan materi dg jelas"],
  ["kualitas_teknis", "Kualitas teknis (audio, video, koneksi)"],
  ["waktu", "Waktu pelaksanaan sesuai & efisien"],
  ["moderator", "Moderator membawakan sesi dg baik"],
  ["info_webinar", "Informasi webinar mudah didapatkan"],
  ["kepuasan", "Puas dengan pelaksanaan webinar"],
  ["minat", "Berminat ikut kegiatan CCC lagi"],
  ["rekomendasi", "Akan merekomendasikan ke rekan"],
] as const;

function text(value: unknown) { return value === null || value === undefined ? "" : String(value); }
function labels(row: ApiRecord): string[] { if (Array.isArray(row.labels)) return row.labels.map(String); if (typeof row.labels === "string") { try { const value = JSON.parse(row.labels); return Array.isArray(value) ? value.map(String) : []; } catch { return row.labels.split(",").map((item) => item.trim()).filter(Boolean); } } return []; }
function distribution(rows: ApiRecord[], key: string) { const map = new Map<string, number>(); rows.forEach((row) => { const value = String(row[key] || "Unknown").trim() || "Unknown"; map.set(value, (map.get(value) || 0) + 1); }); return [...map.entries()].sort((a, b) => b[1] - a[1]); }
function labelColor(label: string) { let hash = 0; for (let index = 0; index < label.length; index += 1) hash = (hash * 31 + label.charCodeAt(index)) >>> 0; return LABEL_COLORS[hash % LABEL_COLORS.length]; }
function categoryTone(categories: ApiRecord[], name: string): PillTone { const found = categories.find((row) => text(row.nama) === name); const color = text(found?.color); return (VALID_TONES.has(color) ? color : "purple") as PillTone; }
function meaningfulAnswer(value: unknown) { const trimmed = String(value || "").trim(); return trimmed.length >= 4 && !/^(sudah\s*(baik|oke)|tidak\s*ada|belum\s*ada|ga(k)?\s*ada|good|oke?|baik|cukup|bagus|mantap|keren|great|-)$/i.test(trimmed); }
function computeKeywords(rows: ApiRecord[]) {
  const frequencies = new Map<string, number>();
  rows.forEach((row) => {
    const words = String(row.komentar || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word && (whitelist.has(word) || (word.length > 2 && !stopwords.has(word))));
    const seen = new Set(words);
    for (let index = 0; index < words.length - 1; index += 1) seen.add(`${words[index]} ${words[index + 1]}`);
    seen.forEach((word) => {
      if (word.includes(" ") && ![...rows].some((other) => other !== row && String(other.komentar || "").toLowerCase().includes(word))) return;
      frequencies.set(word, (frequencies.get(word) || 0) + 1);
    });
  });
  return [...frequencies.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
}

export function CustomerKnowledgeWorkspace({ rows, platforms, categories, freeClassRows }: { rows: ApiRecord[]; platforms: ApiRecord[]; categories: ApiRecord[]; freeClassRows: ApiRecord[] }) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [modal, setModal] = useState<{ record: ApiRecord | null } | null>(null);
  const allLabels = useMemo(() => [...new Set(rows.flatMap(labels))].sort(), [rows]);
  const keywords = useMemo(() => computeKeywords(rows), [rows]);

  return (
    <div className="grid gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <Tabs onValueChange={(value) => setTab(value as Tab)} value={tab}>
          <TabsList variant="line">
            <TabsTrigger value="dashboard"><i className="ti ti-chart-bar" /> Dashboard</TabsTrigger>
            <TabsTrigger value="database"><i className="ti ti-database" /> Database</TabsTrigger>
            <TabsTrigger value="freeclass"><i className="ti ti-chart-dots" /> Analytics Free Class</TabsTrigger>
          </TabsList>
        </Tabs>
        <nav className="flex gap-3 text-xs font-medium text-[var(--purple-mid)]">
          <Link href="/customer-knowledge/platforms">Platforms</Link>
          <Link href="/customer-knowledge/categories">Categories</Link>
        </nav>
      </div>

      {tab === "dashboard" ? <DashboardTab keywords={keywords} rows={rows} /> : null}
      {tab === "database" ? <DatabaseTab categories={categories} onAdd={() => setModal({ record: null })} onEdit={(record) => setModal({ record })} platforms={platforms} rows={rows} /> : null}
      {tab === "freeclass" ? <FreeClassTab rows={freeClassRows} /> : null}

      {modal ? <PainPointModal allLabels={allLabels} categories={categories} onClose={() => setModal(null)} platforms={platforms} record={modal.record} /> : null}
    </div>
  );
}

/* ══════════════ DASHBOARD ══════════════ */
function DashboardTab({ rows, keywords }: { rows: ApiRecord[]; keywords: Array<[string, number]> }) {
  const byCategory = distribution(rows, "kategori");
  const top3 = byCategory.slice(0, 3);
  const maxTop = top3[0]?.[1] || 1;
  const medals = ["🥇", "🥈", "🥉"];
  const byPlatform = distribution(rows, "platform");
  const monthCounts = useMemo(() => { const counts = Array<number>(12).fill(0); rows.forEach((row) => { const index = MONTHS_SHORT.indexOf(text(row.bulan)); if (index > -1) counts[index] += 1; }); return counts; }, [rows]);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card className="gap-2 p-4">
        <h3 className="text-xs font-bold">Top Kategori</h3>
        {!top3.length ? <p className="py-5 text-center text-[12px] text-muted-foreground">Belum ada data</p> : top3.map(([name, count], index) => (
          <div className="grid grid-cols-[20px_minmax(0,1fr)] items-center gap-2 border-t border-border py-2 text-[11px] first:border-0" key={name}>
            <span>{medals[index]}</span>
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2"><span className="truncate font-semibold">{name}</span><span className="shrink-0 text-muted-foreground">{count} entri &middot; {Math.round((count / rows.length) * 100)}%</span></div>
              <div className="mt-1 h-1.5 rounded bg-[var(--bg)]"><i className="block h-full rounded bg-[var(--purple-mid)]" style={{ width: `${(count / maxTop) * 100}%` }} /></div>
            </div>
          </div>
        ))}
      </Card>
      <Card className="gap-2 p-4">
        <h3 className="text-xs font-bold">Top Keywords</h3>
        {!keywords.length ? <p className="py-5 text-center text-[12px] text-muted-foreground">Belum ada data</p> : (
          <div className="flex flex-wrap items-center gap-2">
            {keywords.map(([word, count], index) => (
              <span className="rounded-full bg-[var(--purple-light)] px-2.5 py-1 font-semibold text-[var(--purple-mid)]" key={word} style={{ fontSize: `${10 + Math.round(((keywords.length - index) / Math.max(1, keywords.length)) * 9)}px`, opacity: 0.55 + ((keywords.length - index) / Math.max(1, keywords.length)) * 0.45 }} title={`${count}x`}>{word}</span>
            ))}
          </div>
        )}
      </Card>
      <Card className="gap-2 p-4">
        <h3 className="text-xs font-bold">Entri per Platform</h3>
        {byPlatform.length ? <DistributionChart rows={byPlatform} /> : <p className="py-5 text-center text-[12px] text-muted-foreground">Belum ada data</p>}
      </Card>
      <Card className="gap-2 p-4">
        <h3 className="text-xs font-bold">Entri per Bulan</h3>
        <div style={{ height: 200 }}><MonthlyOpenChart counts={monthCounts} labels={MONTHS_SHORT} /></div>
      </Card>
    </div>
  );
}

/* ══════════════ DATABASE ══════════════ */
function DatabaseTab({ rows, platforms, categories, onAdd, onEdit }: { rows: ApiRecord[]; platforms: ApiRecord[]; categories: ApiRecord[]; onAdd: () => void; onEdit: (record: ApiRecord) => void }) {
  const [query, setQuery] = useState(""); const [platform, setPlatform] = useState(""); const [month, setMonth] = useState(""); const [category, setCategory] = useState(""); const [label, setLabel] = useState("");
  const [pending, start] = useTransition();

  const platformOptions = useMemo(() => distribution(rows, "platform").map(([value]) => value), [rows]);
  const categoryOptions = useMemo(() => distribution(rows, "kategori").map(([value]) => value), [rows]);
  const allLabels = useMemo(() => [...new Set(rows.flatMap(labels))].sort(), [rows]);

  const filtered = useMemo(() => rows.filter((row) => (!platform || row.platform === platform) && (!month || row.bulan === month) && (!category || row.kategori === category) && (!label || labels(row).includes(label)) && (!query || `${row.komentar || ""} ${row.username || ""}`.toLowerCase().includes(query.toLowerCase()))), [rows, platform, month, category, label, query]);

  function remove(id: string) {
    if (!window.confirm("Hapus data ini?\n\nData pain point akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.")) return;
    start(async () => { await deleteManagedRecord("pain_points", id); });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterBar>
          <input className={filterFieldClass} onChange={(event) => setQuery(event.target.value)} placeholder="Cari komentar / username" value={query} />
          <select className={filterFieldClass} onChange={(event) => setPlatform(event.target.value)} value={platform}><option value="">Semua Platform</option>{platformOptions.map((value) => <option key={value}>{value}</option>)}</select>
          <select className={filterFieldClass} onChange={(event) => setMonth(event.target.value)} value={month}><option value="">Semua Bulan</option>{MONTHS_SHORT.map((value) => <option key={value}>{value}</option>)}</select>
          <select className={filterFieldClass} onChange={(event) => setCategory(event.target.value)} value={category}><option value="">Semua Kategori</option>{categoryOptions.map((value) => <option key={value}>{value}</option>)}</select>
          <select className={filterFieldClass} onChange={(event) => setLabel(event.target.value)} value={label}><option value="">Semua Label</option>{allLabels.map((value) => <option key={value}>{value}</option>)}</select>
        </FilterBar>
        <Button onClick={onAdd} size="sm"><i className="ti ti-plus" /> Tambah Data</Button>
      </div>

      <div className="grid gap-2.5">
        {!filtered.length ? (
          <Card className="grid place-items-center gap-2 p-10 text-center text-muted-foreground"><i className="ti ti-database-off text-2xl opacity-40" /><span className="text-[12px]">Belum ada data</span></Card>
        ) : filtered.map((row) => {
          const platformName = text(row.platform);
          const categoryName = text(row.kategori) || "Unknown";
          return (
            <Card className="gap-2.5 p-3.5" key={String(row.id)}>
              <details>
                <summary className="flex cursor-pointer items-start justify-between gap-2">
                  <div className="min-w-0"><strong className="line-clamp-2 text-[12px] font-semibold">{text(row.komentar) || "Tanpa komentar"}</strong><span className="mt-0.5 block text-[11px] text-muted-foreground">{text(row.bulan) || "-"}</span></div>
                  <i className="ti ti-chevron-down shrink-0" />
                </summary>
                <p className="mt-2 text-[12px] text-muted-foreground">{text(row.komentar)}</p>
              </details>
              <div className="flex flex-wrap items-center gap-1.5">
                <Pill tone="blue"><i className={`ti ${PLATFORM_ICONS[platformName.toLowerCase()] || "ti-hash"}`} /> {platformName || "Unknown"}</Pill>
                <Pill tone={categoryTone(categories, categoryName)}>{categoryName}</Pill>
                {labels(row).map((value) => { const color = labelColor(value); return <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" key={value} style={{ background: color.bg, color: color.color }}>{value}</span>; })}
                <span className="ml-auto flex shrink-0 gap-1">
                  <button className="p-1 text-muted-foreground" onClick={() => onEdit(row)} type="button"><i className="ti ti-pencil" /></button>
                  <button className="p-1 text-[var(--red)]" disabled={pending} onClick={() => remove(String(row.id))} type="button"><i className="ti ti-trash" /></button>
                </span>
              </div>
            </Card>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">{filtered.length} dari {rows.length} entri</p>
    </>
  );
}

/* ══════════════ ADD / EDIT MODAL ══════════════ */
async function fileToBase64(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
  return dataUrl.split(",")[1] || "";
}

function LabelPicker({ selected, allLabels, onChange }: { selected: string[]; allLabels: string[]; onChange: (next: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const available = allLabels.filter((value) => !selected.includes(value));

  function add(value: string) {
    const trimmed = value.trim();
    if (!trimmed || selected.includes(trimmed)) return;
    onChange([...selected, trimmed]);
  }
  function commitDraft() { add(draft); setDraft(""); setCreating(false); setOpen(false); }

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border-md)] bg-[var(--bg)] p-2">
        {selected.map((value) => { const color = labelColor(value); return (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" key={value} style={{ background: color.bg, color: color.color }}>
            {value}
            <button onClick={() => onChange(selected.filter((item) => item !== value))} type="button"><i className="ti ti-x" style={{ fontSize: 9 }} /></button>
          </span>
        ); })}
        <button className="text-[11px] text-muted-foreground" onClick={() => setOpen((value) => !value)} type="button">Label... <i className="ti ti-chevron-down" style={{ fontSize: 10 }} /></button>
      </div>
      {open ? (
        <div className="absolute z-20 mt-1 max-h-[180px] w-full min-w-[200px] overflow-y-auto rounded-lg border border-border bg-white p-2 shadow-md">
          {available.map((value) => <button className="block w-full rounded px-2 py-1 text-left text-[11px] hover:bg-[var(--bg)]" key={value} onClick={() => { add(value); setOpen(false); }} type="button">{value}</button>)}
          {!available.length && !creating ? <p className="px-2 py-1 text-[10px] text-muted-foreground">Tidak ada label lain</p> : null}
          {creating ? (
            <div className="flex gap-1 p-1">
              <input autoFocus className="h-7 flex-1 rounded border border-border px-2 text-[11px]" onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") commitDraft(); }} placeholder="Nama label baru..." value={draft} />
              <button className="rounded bg-[var(--purple-mid)] px-2 text-[10px] text-white" onClick={commitDraft} type="button">Tambah</button>
            </div>
          ) : (
            <button className="mt-1 block w-full rounded px-2 py-1 text-left text-[11px] text-[var(--purple-mid)] hover:bg-[var(--bg)]" onClick={() => setCreating(true)} type="button">+ Buat label baru</button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function PainPointModal({ record, platforms, categories, allLabels, onClose }: { record: ApiRecord | null; platforms: ApiRecord[]; categories: ApiRecord[]; allLabels: string[]; onClose: () => void }) {
  const platformNames = useMemo(() => platforms.map((row) => text(row.nama)).filter(Boolean), [platforms]);
  const categoryNames = useMemo(() => categories.map((row) => text(row.nama)).filter(Boolean), [categories]);
  const [komentar, setKomentar] = useState(text(record?.komentar));
  const [platform, setPlatform] = useState(text(record?.platform) || platformNames[0] || "");
  const [bulan, setBulan] = useState(text(record?.bulan) || MONTHS_SHORT[new Date().getMonth()]);
  const [kategori, setKategori] = useState(text(record?.kategori) || categoryNames[0] || "");
  const [selectedLabels, setSelectedLabels] = useState<string[]>(record ? labels(record) : []);
  const [pending, start] = useTransition();
  const [aiStatus, setAiStatus] = useState("Drop, paste, atau upload screenshot.");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const esc = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  async function parseScreenshot(file: File) {
    if (!file.type.startsWith("image/")) { setAiStatus("Hanya file gambar yang didukung."); return; }
    setAiStatus("Membaca screenshot...");
    try {
      const response = await fetch("/api/ai/parse-screenshot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: await fileToBase64(file), mediaType: file.type, categories: categoryNames }) });
      const payload = await response.json() as { komentar?: string; platform?: string; kategori?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal parse screenshot.");
      if (payload.komentar) setKomentar(payload.komentar);
      if (payload.platform) { const match = platformNames.find((value) => value.toLowerCase() === payload.platform!.toLowerCase()); if (match) setPlatform(match); }
      if (payload.kategori) { const match = categoryNames.find((value) => value.toLowerCase() === payload.kategori!.toLowerCase()); if (match) setKategori(match); }
      setAiStatus("Berhasil diparsing! Cek & lengkapi field di bawah.");
    } catch (error) { setAiStatus(error instanceof Error ? error.message : "Gagal parse screenshot."); }
  }

  function save() {
    if (!komentar.trim()) { window.alert("Komentar wajib diisi"); return; }
    const formData = new FormData();
    formData.set("komentar", komentar.trim());
    formData.set("platform", platform);
    formData.set("bulan", bulan);
    formData.set("kategori", kategori);
    formData.set("username", text(record?.username));
    formData.set("source_url", text(record?.source_url));
    formData.set("notes", text(record?.notes));
    formData.set("labels", JSON.stringify(selectedLabels));
    start(async () => {
      try {
        if (record) await updateManagedRecord("pain_points", String(record.id), formData);
        else await createManagedRecord("pain_points", formData);
        onClose();
      } catch (error) { window.alert(error instanceof Error ? error.message : "Gagal simpan data"); }
    });
  }

  const inputClass = "w-full rounded-[var(--radius)] border border-[var(--border-md)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--purple-accent)]";
  const labelClass = "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground";

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/45 p-4" onMouseDown={onClose}>
      <Card className="flex max-h-[90vh] w-full max-w-[560px] flex-col gap-0 overflow-hidden p-0" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-bold">{record ? "Edit" : "Tambah"} Data</h2>
          <button onClick={onClose} type="button"><i className="ti ti-x" /></button>
        </div>
        <div className="flex flex-col gap-3.5 overflow-y-auto p-5">
          {!record ? (
            <div className="rounded-lg border border-dashed border-[var(--border-md)] p-3 text-center" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const image = Array.from(event.dataTransfer.files).find((file) => file.type.startsWith("image/")); if (image) void parseScreenshot(image); }} onPaste={(event) => { const image = Array.from(event.clipboardData.files).find((file) => file.type.startsWith("image/")); if (image) { event.preventDefault(); void parseScreenshot(image); } }} tabIndex={0}>
              <button className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--purple-mid)]" onClick={() => inputRef.current?.click()} type="button"><i className="ti ti-camera" /> Upload atau paste screenshot (Ctrl+V)</button>
              <input accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void parseScreenshot(file); }} ref={inputRef} type="file" />
              <p className="mt-1 text-[10px] text-muted-foreground">{aiStatus}</p>
            </div>
          ) : null}
          <div><label className={labelClass}>Komentar / Diskusi *</label><textarea className={inputClass} onChange={(event) => setKomentar(event.target.value)} placeholder="Paste komentar dari TikTok, IG, X..." rows={3} value={komentar} /></div>
          <div className="grid grid-cols-3 gap-2.5">
            <div><label className={labelClass}>Platform *</label><select className={inputClass} onChange={(event) => setPlatform(event.target.value)} value={platform}>{platformNames.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
            <div><label className={labelClass}>Bulan *</label><select className={inputClass} onChange={(event) => setBulan(event.target.value)} value={bulan}>{MONTHS_SHORT.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
            <div><label className={labelClass}>Kategori *</label><select className={inputClass} onChange={(event) => setKategori(event.target.value)} value={kategori}>{categoryNames.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
          </div>
          <div><label className={labelClass}>Labels</label><LabelPicker allLabels={allLabels} onChange={setSelectedLabels} selected={selectedLabels} /></div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button onClick={onClose} size="sm" variant="outline">Batal</Button>
          <Button disabled={pending} onClick={save} size="sm"><i className="ti ti-check" /> Simpan</Button>
        </div>
      </Card>
    </div>
  );
}

/* ══════════════ ANALYTICS FREE CLASS ══════════════ */
function FreeClassTab({ rows }: { rows: ApiRecord[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const { pageItems, page, setPage, totalPages } = usePagination(rows, 15);

  const analytics = useMemo(() => {
    const ratings = RATING_FIELDS.map(([key, label]) => {
      const values = rows.map((row) => Number(row[key])).filter((value) => value >= 1 && value <= 5);
      const dist = [1, 2, 3, 4, 5].map((star) => values.filter((value) => Math.round(value) === star).length);
      return { key, label, average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0, count: values.length, dist };
    }).filter((item) => item.count).sort((a, b) => a.average - b.average);
    const overall = ratings.length ? ratings.reduce((sum, item) => sum + item.average, 0) / ratings.length : 0;
    return { ratings, overall, series: distribution(rows, "seri"), universities: distribution(rows, "universitas").slice(0, 8), cohorts: distribution(rows, "angkatan") };
  }, [rows]);

  async function importRows(formData: FormData) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/free-class/import", { method: "POST", body: formData });
      const result = await response.json() as { imported?: number; error?: string };
      if (!response.ok) throw new Error(result.error || "Import gagal.");
      setMessage(`${result.imported || 0} data berhasil disimpan ✓`);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Import gagal."); }
    finally { setBusy(false); }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `free-class-analytics-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!rows.length) {
    return (
      <Card className="grid place-items-center gap-3 p-12 text-center">
        <i className="ti ti-chart-dots text-3xl text-muted-foreground opacity-40" />
        <div><strong className="block text-[13px]">Belum ada data</strong><span className="text-[11px] text-muted-foreground">Upload file CSV dari Google Sheets</span></div>
        <ImportPanel busy={busy} message={message} onImport={importRows} />
      </Card>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ImportPanel busy={busy} message={message} onImport={importRows} />
        <Button onClick={exportJson} size="sm" variant="outline"><i className="ti ti-download" /> Export JSON</Button>
      </div>
      <StatsGrid className="mb-0 grid-cols-3">
        <StatCard label="Total Responden" value={rows.length} />
        <StatCard label="Avg Keseluruhan" tone="var(--purple-mid)" value={`${analytics.overall.toFixed(2)} / 5.0`} />
        <StatCard label="Free Class Series" value={analytics.series.length} />
      </StatsGrid>
      <Card className="gap-2.5 p-4">
        <h3 className="text-xs font-bold">Rating per Aspek <span className="font-normal text-muted-foreground">&mdash; urut terendah ke tertinggi</span></h3>
        {analytics.ratings.map((item) => (
          <div className="grid gap-1 border-t border-border py-2 text-[11px] first:border-0" key={item.key}>
            <div className="flex items-center justify-between gap-2"><span>{item.label}{item.count < rows.length ? <small className="text-muted-foreground"> n={item.count}</small> : null}</span><strong>{item.average.toFixed(2)}</strong></div>
            <progress className="h-1.5 w-full" max={5} value={item.average} />
            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">{item.dist.map((count, index) => <span key={index}>{index + 1}&#9733; {count}</span>)}</div>
          </div>
        ))}
      </Card>
      <div className="grid gap-3 md:grid-cols-3">
        <Distribution rows={analytics.series} title="Responden per Series" />
        <Distribution rows={analytics.universities} title="Top Universitas" />
        <Distribution rows={analytics.cohorts} title="Persebaran Angkatan" />
      </div>
      <OpenAnswers field="hal_baik" rows={rows} title="Hal yang Sudah Baik" />
      <OpenAnswers field="ditingkatkan" rows={rows} title="Yang Perlu Ditingkatkan" />
      <OpenAnswers field="topik_keinginan" rows={rows} title="Topik yang Ingin Dipelajari" />
      <details className="rounded-lg border border-border bg-white">
        <summary className="cursor-pointer px-4 py-3 text-xs font-bold"><i className="ti ti-users" /> Daftar Responden ({rows.length})</summary>
        <div className="overflow-x-auto px-4 pb-2">
          <table className="w-full text-[11px]">
            <thead><tr className="text-left text-muted-foreground"><th className="py-1.5">Email</th><th>Nama</th><th>Universitas</th><th>Angkatan</th><th>Series</th></tr></thead>
            <tbody>{pageItems.map((row) => <tr className="border-t border-border" key={String(row.id)}><td className="py-1.5">{text(row.email) || "-"}</td><td>{text(row.nama) || "-"}</td><td>{text(row.universitas) || "-"}</td><td>{text(row.angkatan) || "-"}</td><td>{text(row.seri) || "-"}</td></tr>)}</tbody>
          </table>
        </div>
        <Pagination className="pb-3" onChange={setPage} page={page} totalPages={totalPages} />
      </details>
    </>
  );
}

function ImportPanel({ busy, message, onImport }: { busy: boolean; message: string; onImport: (formData: FormData) => void }) {
  const [showUrl, setShowUrl] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={onImport}>
        <label className={`${filterFieldClass} inline-flex cursor-pointer items-center gap-1.5`}><i className="ti ti-upload" /> Upload CSV<input accept=".csv,.xlsx" className="hidden" name="file" onChange={(event) => event.currentTarget.form?.requestSubmit()} type="file" /></label>
      </form>
      <Button onClick={() => setShowUrl((value) => !value)} size="sm" variant="outline"><i className="ti ti-link" /> Import URL</Button>
      {showUrl ? (
        <form action={onImport} className="flex items-center gap-2">
          <input className={filterFieldClass} name="url" placeholder="https://docs.google.com/.../pub?output=csv" style={{ minWidth: 260 }} type="url" />
          <Button disabled={busy} size="sm" type="submit"><i className="ti ti-download" /> Ambil Data</Button>
        </form>
      ) : null}
      {message ? <span className="text-[11px] text-muted-foreground">{message}</span> : null}
    </div>
  );
}

function Distribution({ title, rows }: { title: string; rows: [string, number][] }) {
  return <Card className="gap-2 p-4"><h3 className="text-xs font-bold">{title}</h3>{rows.length ? <DistributionChart rows={rows} /> : <p className="text-[11px] text-muted-foreground">Belum ada data</p>}</Card>;
}

function OpenAnswers({ title, field, rows }: { title: string; field: string; rows: ApiRecord[] }) {
  const answers = rows.filter((row) => meaningfulAnswer(row[field]));
  if (!answers.length) return null;
  return (
    <Card className="gap-2.5 p-4">
      <h3 className="text-xs font-bold">{title} <span className="font-normal text-muted-foreground">({answers.length} jawaban)</span></h3>
      <div className="grid gap-2">
        {answers.map((row) => (
          <blockquote className="border-l-[3px] border-border bg-[var(--bg)] py-1.5 pl-3 text-[11px] leading-relaxed" key={String(row.id)}>
            <p className="m-0">{text(row[field])}</p>
            <footer className="mt-1 text-[10px] text-muted-foreground">{text(row.nama) || text(row.email) || "Anonymous"} &middot; {text(row.seri)}</footer>
          </blockquote>
        ))}
      </div>
    </Card>
  );
}
