"use client";

import { createManagedRecord, deleteManagedRecord, updateManagedRecord } from "@/app/actions/record-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApiRecord } from "@/lib/api/_crud";
import { useMemo, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { FilterBar, Pagination, Pill, StatCard, StatsGrid, filterFieldClass, usePagination } from "./ui-kit";

type Tab = "overview" | "master" | "pipeline" | "deals" | "outreach";
type PillTone = "green" | "amber" | "red" | "blue" | "purple" | "gray";

const STATUSES = ["Approached", "Sales Meet", "Negotiation", "Closed Deal", "Closed Lost"];
const TIERS = ["Strategic", "Standard"];
const DEAL_STAGES = ["Active", "Negotiation", "Done", "Cancelled"];
const CHANNELS = ["WhatsApp", "Email", "LinkedIn", "Meeting"];
const RESPONSES = ["Replied", "No Reply", "Meeting Scheduled", "Declined"];
const STATUS_TONE: Record<string, PillTone> = { Approached: "blue", "Sales Meet": "purple", Negotiation: "amber", "Closed Deal": "green", "Closed Lost": "red" };
const STATUS_DOT: Record<string, string> = { Approached: "#0f52ba", "Sales Meet": "#f59e0b", Negotiation: "#854f0b", "Closed Deal": "#3b6d11", "Closed Lost": "#e24b4a" };
const PARTNER_FIELDS = ["name", "type", "category", "tier", "status", "contact_name", "contact_email", "contact_phone", "pos", "li", "scope", "notes", "input_date"];

function text(value: unknown) { return value === null || value === undefined ? "" : String(value); }
function localIso(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function cell(value: unknown) { if (value === null || value === undefined) return ""; if (value instanceof Date) return localIso(value); return String(value); }
function dayValue(value: unknown) { return value instanceof Date ? localIso(value) : text(value).slice(0, 10); }
function distribution(rows: ApiRecord[], key: string) { const map = new Map<string, number>(); rows.forEach((row) => { const value = text(row[key]) || "Unknown"; map.set(value, (map.get(value) || 0) + 1); }); return [...map.entries()].sort((a, b) => b[1] - a[1]); }
function buildFd(fields: string[], values: Record<string, unknown>) { const fd = new FormData(); for (const key of fields) fd.set(key, cell(values[key])); return fd; }

const inlineInput: CSSProperties = { width: "100%", padding: "5px 7px", border: "0.5px solid transparent", borderRadius: 6, fontSize: 11, background: "transparent", color: "var(--text)", outline: "none" };

type Props = {
  title: string;
  entityLabel: string;
  rows: ApiRecord[];
  deals: ApiRecord[];
  outreach: ApiRecord[];
  tableKey: string;
  dealsKey: string;
  outreachKey: string;
  partnerField: string;
  categories: string[];
  aiPanel?: ReactNode;
};

export function PartnershipWorkspace({ entityLabel, rows, deals, outreach, tableKey, dealsKey, outreachKey, partnerField, categories, aiPanel }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState<{ record: ApiRecord | null } | null>(null);

  return (
    <div className="grid gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <Tabs onValueChange={(value) => setTab(value as Tab)} value={tab}>
          <TabsList variant="line">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="master"><i className="ti ti-database" /> Master Data</TabsTrigger>
            <TabsTrigger value="pipeline"><i className="ti ti-layout-kanban" /> Pipeline</TabsTrigger>
            <TabsTrigger value="deals">Deals &amp; Scope</TabsTrigger>
            <TabsTrigger value="outreach"><i className="ti ti-send" /> Outreach Log</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={() => setEditing({ record: null })} size="sm"><i className="ti ti-plus" /> Tambah</Button>
      </div>

      {tab === "overview" ? <OverviewTab rows={rows} entityLabel={entityLabel} onEdit={(record) => setEditing({ record })} /> : null}
      {tab === "master" ? <MasterTab aiPanel={aiPanel} rows={rows} tableKey={tableKey} onAdd={() => setEditing({ record: null })} onEdit={(record) => setEditing({ record })} /> : null}
      {tab === "pipeline" ? <PipelineTab rows={rows} tableKey={tableKey} onAdd={() => setEditing({ record: null })} onEdit={(record) => setEditing({ record })} /> : null}
      {tab === "deals" ? <DealsTab rows={rows} deals={deals} dealsKey={dealsKey} partnerField={partnerField} /> : null}
      {tab === "outreach" ? <OutreachTab rows={rows} outreach={outreach} outreachKey={outreachKey} partnerField={partnerField} /> : null}

      {editing ? <PartnerModal profile={editing.record} tableKey={tableKey} categories={categories} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

/* ── Overview ── */
function OverviewTab({ rows, entityLabel, onEdit }: { rows: ApiRecord[]; entityLabel: string; onEdit: (record: ApiRecord) => void }) {
  const count = (status: string) => rows.filter((row) => text(row.status) === status).length;
  return (
    <>
      <StatsGrid className="mb-0 grid-cols-2 md:grid-cols-5">
        <StatCard label={`Total ${entityLabel}`} value={rows.length} />
        <StatCard label="Approached" tone="var(--blue)" value={count("Approached")} />
        <StatCard label="Negotiation" tone="var(--amber)" value={count("Negotiation")} />
        <StatCard label="Closed Deal" tone="var(--green)" value={count("Closed Deal")} />
        <StatCard label="Tier Strategic" value={rows.filter((row) => text(row.tier) === "Strategic").length} />
      </StatsGrid>
      <div className="grid gap-3 md:grid-cols-3">
        <Distribution rows={distribution(rows, "status")} title="Pipeline stage" />
        <Distribution rows={distribution(rows, "category")} title="Category" />
        <Distribution rows={distribution(rows, "tier")} title="Tier" />
      </div>
      <Card className="gap-0 p-4">
        <h3 className="mb-3 text-[13px] font-bold">Partner Terbaru &amp; Aktif</h3>
        {!rows.length ? <p className="py-6 text-center text-[12px] text-muted-foreground">Belum ada partner.</p> : rows.slice(0, 8).map((row) => (
          <button className="flex items-center gap-2.5 border-t border-border py-2.5 text-left first:border-0" key={String(row.id)} onClick={() => onEdit(row)} type="button">
            <div className="min-w-0 flex-1"><strong className="block truncate text-[12px] text-[var(--purple-mid)]">{text(row.name)}</strong><span className="text-[10px] text-muted-foreground">{text(row.category) || "—"} · {text(row.contact_name) || "tanpa PIC"}</span></div>
            <Pill tone="purple">{text(row.tier) || "—"}</Pill>
            <Pill tone={STATUS_TONE[text(row.status)] || "gray"}>{text(row.status) || "—"}</Pill>
          </button>
        ))}
      </Card>
    </>
  );
}

function Distribution({ title, rows }: { title: string; rows: [string, number][] }) {
  const maximum = Math.max(1, ...rows.map(([, value]) => value));
  return (
    <Card className="gap-2 p-4">
      <h3 className="text-xs font-bold">{title}</h3>
      {rows.map(([label, value]) => <div className="grid grid-cols-[90px_minmax(0,1fr)_28px] items-center gap-2 text-[10px]" key={label}><span className="overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground">{label}</span><i className="block h-2 min-w-[2px] rounded bg-[var(--purple-mid)]" style={{ width: `${(value / maximum) * 100}%` }} /><strong className="text-right">{value}</strong></div>)}
    </Card>
  );
}

/* ── Master Data ── */
function MasterTab({ rows, tableKey, aiPanel, onAdd, onEdit }: { rows: ApiRecord[]; tableKey: string; aiPanel?: ReactNode; onAdd: () => void; onEdit: (record: ApiRecord) => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [tier, setTier] = useState("");
  const [pending, start] = useTransition();
  const filtered = useMemo(() => rows.filter((row) => (!query || `${text(row.name)} ${text(row.contact_name)}`.toLowerCase().includes(query.toLowerCase())) && (!status || text(row.status) === status) && (!tier || text(row.tier) === tier)), [rows, query, status, tier]);
  const { pageItems, page, setPage, totalPages } = usePagination(filtered, 15);

  function remove(id: string) {
    if (!window.confirm("Hapus partner ini? Data partner dan deal terkait akan ikut terhapus.")) return;
    start(async () => { await deleteManagedRecord(tableKey, id); });
  }
  function exportCsv() {
    const headers = ["name", "category", "tier", "status", "contact_name", "contact_email", "contact_phone", "pos", "li", "scope", "notes", "input_date"];
    const content = [headers.join(","), ...filtered.map((row) => headers.map((key) => `"${cell(row[key]).replaceAll('"', '""')}"`).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${tableKey}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return (
    <>
      {aiPanel ? <div>{aiPanel}</div> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterBar>
          <input className={filterFieldClass} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama / PIC..." value={query} />
          <select className={filterFieldClass} onChange={(event) => setStatus(event.target.value)} value={status}><option value="">Semua status</option>{STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}</select>
          <select className={filterFieldClass} onChange={(event) => setTier(event.target.value)} value={tier}><option value="">Semua tier</option>{TIERS.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        </FilterBar>
        <div className="flex gap-2">
          <Button onClick={exportCsv} size="sm" variant="outline"><i className="ti ti-download" /> Export CSV</Button>
          <Button onClick={onAdd} size="sm"><i className="ti ti-plus" /> Tambah</Button>
        </div>
      </div>
      <Card className="gap-0 p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Nama Company</TableHead><TableHead>Category</TableHead><TableHead>Tier</TableHead><TableHead>PIC</TableHead><TableHead>Phone</TableHead><TableHead>Status</TableHead><TableHead>Scope</TableHead><TableHead>Input</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {!pageItems.length ? <TableRow><TableCell className="py-8 text-center text-muted-foreground" colSpan={9}>Tidak ada data</TableCell></TableRow> : pageItems.map((row) => (
                <TableRow key={String(row.id)}>
                  <TableCell className="cursor-pointer font-medium text-[var(--purple-mid)]" onClick={() => onEdit(row)}>{text(row.name)}</TableCell>
                  <TableCell>{text(row.category) || "-"}</TableCell>
                  <TableCell><Pill tone="purple">{text(row.tier) || "-"}</Pill></TableCell>
                  <TableCell>{text(row.contact_name) || "-"}</TableCell>
                  <TableCell>{text(row.contact_phone) || "-"}</TableCell>
                  <TableCell><Pill tone={STATUS_TONE[text(row.status)] || "gray"}>{text(row.status) || "-"}</Pill></TableCell>
                  <TableCell className="max-w-[160px] truncate" title={text(row.scope)}>{text(row.scope) || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{dayValue(row.input_date) || "-"}</TableCell>
                  <TableCell><button className="p-1 text-muted-foreground hover:text-[var(--red)]" disabled={pending} onClick={() => remove(String(row.id))} type="button"><i className="ti ti-trash" /></button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Pagination className="p-3" onChange={setPage} page={page} totalPages={totalPages} />
      </Card>
      <p className="text-[11px] text-muted-foreground">{filtered.length} dari {rows.length} data</p>
    </>
  );
}

/* ── Pipeline (kanban) ── */
function PipelineTab({ rows, tableKey, onAdd, onEdit }: { rows: ApiRecord[]; tableKey: string; onAdd: () => void; onEdit: (record: ApiRecord) => void }) {
  const [pending, start] = useTransition();
  const [dragId, setDragId] = useState("");

  function moveTo(status: string) {
    const row = rows.find((item) => String(item.id) === dragId);
    setDragId("");
    if (!row || text(row.status) === status) return;
    start(async () => { await updateManagedRecord(tableKey, String(row.id), buildFd(PARTNER_FIELDS, { ...row, type: text(row.type) || "Corporate", status })); });
  }

  return (
    <>
      <div className="text-[12px] text-muted-foreground">{rows.length} partner · drag kartu untuk pindah stage {pending ? "· menyimpan..." : ""}</div>
      <div className="flex gap-2.5 overflow-x-auto pb-2">
        {STATUSES.map((status) => {
          const items = rows.filter((row) => text(row.status) === status);
          return (
            <div className="flex min-w-[220px] flex-1 flex-col rounded-xl bg-[var(--bg)] p-2" key={status} onDragOver={(event) => event.preventDefault()} onDrop={() => moveTo(status)}>
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold"><span className="inline-block h-2 w-2 rounded-full" style={{ background: STATUS_DOT[status] }} />{status}</span>
                <span className="rounded-full bg-[var(--white)] px-1.5 text-[10px] text-muted-foreground">{items.length}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {!items.length ? <div className="py-5 text-center text-[11px] text-[var(--text-hint)]">Kosong</div> : items.map((row) => (
                  <div className="cursor-pointer rounded-lg border border-border bg-[var(--white)] p-2.5" draggable key={String(row.id)} onClick={() => onEdit(row)} onDragStart={() => setDragId(String(row.id))}>
                    <div className="text-[12px] font-semibold">{text(row.name)}</div>
                    <div className="text-[10px] text-muted-foreground">{text(row.category) || "—"}</div>
                    <div className="mt-1 flex items-center gap-1.5"><Pill tone="purple">{text(row.tier) || "—"}</Pill>{text(row.contact_name) ? <span className="text-[10px] text-muted-foreground">{text(row.contact_name)}</span> : null}</div>
                  </div>
                ))}
                <button className="py-1 text-center text-[10px] text-[var(--purple-accent)]" onClick={onAdd} type="button">+ Tambah</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ── Deals & Scope (inline table) ── */
function DealsTab({ rows, deals, dealsKey, partnerField }: { rows: ApiRecord[]; deals: ApiRecord[]; dealsKey: string; partnerField: string }) {
  const fields = [partnerField, "title", "stage", "scope", "deadline", "value", "notes"];
  const [selectedPartner, setSelectedPartner] = useState("");
  const [pending, start] = useTransition();
  const partnerName = (id: unknown) => text(rows.find((row) => String(row.id) === String(id))?.name) || "-";
  const saveField = (deal: ApiRecord, patch: Record<string, unknown>) => start(async () => { await updateManagedRecord(dealsKey, String(deal.id), buildFd(fields, { ...deal, ...patch })); });
  const add = () => start(async () => { await createManagedRecord(dealsKey, buildFd(fields, { [partnerField]: selectedPartner || null, title: "Deal baru", stage: "Negotiation" })); });
  const remove = (id: string) => { if (window.confirm("Hapus deal ini?")) start(async () => { await deleteManagedRecord(dealsKey, id); }); };

  return (
    <Card className="gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><div className="text-[13px] font-semibold">Deals &amp; Scope Kolaborasi</div><div className="text-[11px] text-muted-foreground">Edit langsung di tabel. Satu partner bisa punya beberapa deal.</div></div>
        <div className="flex items-center gap-2">
          <select className={filterFieldClass} onChange={(event) => setSelectedPartner(event.target.value)} value={selectedPartner}><option value="">Pilih partner...</option>{rows.map((row) => <option key={String(row.id)} value={String(row.id)}>{text(row.name)}</option>)}</select>
          <Button disabled={pending} onClick={add} size="sm"><i className="ti ti-plus" /> Tambah Deal</Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Nama Deal</TableHead><TableHead>Partner</TableHead><TableHead>Status</TableHead><TableHead>Scope</TableHead><TableHead>Deadline</TableHead><TableHead>Nilai</TableHead><TableHead>Catatan</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {!deals.length ? <TableRow><TableCell className="py-8 text-center text-muted-foreground" colSpan={8}>Belum ada deal</TableCell></TableRow> : deals.map((deal) => (
              <TableRow key={String(deal.id)}>
                <TableCell><input defaultValue={text(deal.title)} onBlur={(event) => { if (event.target.value !== text(deal.title)) saveField(deal, { title: event.target.value }); }} style={inlineInput} /></TableCell>
                <TableCell className="text-muted-foreground">{partnerName(deal[partnerField])}</TableCell>
                <TableCell><select defaultValue={text(deal.stage) || "Negotiation"} onChange={(event) => saveField(deal, { stage: event.target.value })} style={inlineInput}>{DEAL_STAGES.map((value) => <option key={value} value={value}>{value}</option>)}</select></TableCell>
                <TableCell><input defaultValue={text(deal.scope)} onBlur={(event) => { if (event.target.value !== text(deal.scope)) saveField(deal, { scope: event.target.value }); }} style={inlineInput} /></TableCell>
                <TableCell><input defaultValue={dayValue(deal.deadline)} onChange={(event) => saveField(deal, { deadline: event.target.value })} style={{ ...inlineInput, minWidth: 120 }} type="date" /></TableCell>
                <TableCell><input defaultValue={text(deal.value)} onBlur={(event) => { if (event.target.value !== text(deal.value)) saveField(deal, { value: event.target.value }); }} style={inlineInput} /></TableCell>
                <TableCell><input defaultValue={text(deal.notes)} onBlur={(event) => { if (event.target.value !== text(deal.notes)) saveField(deal, { notes: event.target.value }); }} style={inlineInput} /></TableCell>
                <TableCell><button className="p-1 text-muted-foreground hover:text-[var(--red)]" onClick={() => remove(String(deal.id))} type="button"><i className="ti ti-trash" /></button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

/* ── Outreach Log (inline table) ── */
function OutreachTab({ rows, outreach, outreachKey, partnerField }: { rows: ApiRecord[]; outreach: ApiRecord[]; outreachKey: string; partnerField: string }) {
  const fields = [partnerField, "channel", "tanggal", "isi", "respons", "catatan"];
  const [selectedPartner, setSelectedPartner] = useState("");
  const [pending, start] = useTransition();
  const partnerName = (id: unknown) => text(rows.find((row) => String(row.id) === String(id))?.name) || "-";
  const saveField = (log: ApiRecord, patch: Record<string, unknown>) => start(async () => { await updateManagedRecord(outreachKey, String(log.id), buildFd(fields, { ...log, ...patch })); });
  const add = () => start(async () => { await createManagedRecord(outreachKey, buildFd(fields, { [partnerField]: selectedPartner || null, channel: "WhatsApp", tanggal: localIso(new Date()), respons: "No Reply" })); });
  const remove = (id: string) => { if (window.confirm("Hapus log outreach ini?")) start(async () => { await deleteManagedRecord(outreachKey, id); }); };

  return (
    <Card className="gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><div className="text-[13px] font-semibold">Outreach Log</div><div className="text-[11px] text-muted-foreground">Catat semua aktivitas outreach per partner. Edit langsung.</div></div>
        <div className="flex items-center gap-2">
          <select className={filterFieldClass} onChange={(event) => setSelectedPartner(event.target.value)} value={selectedPartner}><option value="">Pilih partner...</option>{rows.map((row) => <option key={String(row.id)} value={String(row.id)}>{text(row.name)}</option>)}</select>
          <Button disabled={pending} onClick={add} size="sm"><i className="ti ti-plus" /> Catat Outreach</Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Partner</TableHead><TableHead>Channel</TableHead><TableHead>Tanggal</TableHead><TableHead>Isi Outreach</TableHead><TableHead>Respons</TableHead><TableHead>Catatan</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {!outreach.length ? <TableRow><TableCell className="py-8 text-center text-muted-foreground" colSpan={7}>Belum ada log outreach</TableCell></TableRow> : outreach.map((log) => (
              <TableRow key={String(log.id)}>
                <TableCell className="font-medium">{partnerName(log[partnerField])}</TableCell>
                <TableCell><select defaultValue={text(log.channel) || "WhatsApp"} onChange={(event) => saveField(log, { channel: event.target.value })} style={inlineInput}>{CHANNELS.map((value) => <option key={value} value={value}>{value}</option>)}</select></TableCell>
                <TableCell><input defaultValue={dayValue(log.tanggal)} onChange={(event) => saveField(log, { tanggal: event.target.value })} style={{ ...inlineInput, minWidth: 120 }} type="date" /></TableCell>
                <TableCell><input defaultValue={text(log.isi)} onBlur={(event) => { if (event.target.value !== text(log.isi)) saveField(log, { isi: event.target.value }); }} style={inlineInput} /></TableCell>
                <TableCell><select defaultValue={text(log.respons) || "No Reply"} onChange={(event) => saveField(log, { respons: event.target.value })} style={inlineInput}>{RESPONSES.map((value) => <option key={value} value={value}>{value}</option>)}</select></TableCell>
                <TableCell><input defaultValue={text(log.catatan)} onBlur={(event) => { if (event.target.value !== text(log.catatan)) saveField(log, { catatan: event.target.value }); }} style={inlineInput} /></TableCell>
                <TableCell><button className="p-1 text-muted-foreground hover:text-[var(--red)]" onClick={() => remove(String(log.id))} type="button"><i className="ti ti-trash" /></button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

/* ── Add / Edit partner modal ── */
function PartnerModal({ profile, tableKey, categories, onClose }: { profile: ApiRecord | null; tableKey: string; categories: string[]; onClose: () => void }) {
  const [form, setForm] = useState({
    name: text(profile?.name), category: text(profile?.category), tier: text(profile?.tier) || "Standard", status: text(profile?.status) || "Approached",
    contact_name: text(profile?.contact_name), pos: text(profile?.pos), contact_phone: text(profile?.contact_phone), contact_email: text(profile?.contact_email),
    li: text(profile?.li), scope: text(profile?.scope), notes: text(profile?.notes), input_date: dayValue(profile?.input_date),
  });
  const [pending, start] = useTransition();
  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  function save() {
    if (!form.name.trim()) { window.alert("Nama wajib diisi!"); return; }
    const fd = buildFd(PARTNER_FIELDS, { ...form, type: "Corporate" });
    start(async () => {
      try {
        if (profile) await updateManagedRecord(tableKey, String(profile.id), fd);
        else await createManagedRecord(tableKey, fd);
        onClose();
      } catch (error) { window.alert(error instanceof Error ? error.message : "Gagal simpan partner"); }
    });
  }

  const labelClass = "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground";
  const inputClass = "w-full rounded-[var(--radius)] border border-[var(--border-md)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--purple-accent)]";

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/45 p-4" onMouseDown={onClose}>
      <Card className="flex max-h-[90vh] w-full max-w-[520px] flex-col gap-0 overflow-hidden p-0" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-bold">{profile ? text(profile.name) || "Edit Partner" : "Tambah Partner Baru"}</h2>
          <button onClick={onClose} type="button"><i className="ti ti-x" /></button>
        </div>
        <div className="flex flex-col gap-3 overflow-y-auto p-5">
          <div><label className={labelClass}>Nama Company *</label><input className={inputClass} onChange={(event) => set({ name: event.target.value })} placeholder="Nama perusahaan / organisasi" value={form.name} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>Category</label><select className={inputClass} onChange={(event) => set({ category: event.target.value })} value={form.category}><option value="">— Pilih —</option>{categories.map((value) => <option key={value} value={value}>{value}</option>)}{form.category && !categories.includes(form.category) ? <option value={form.category}>{form.category}</option> : null}</select></div>
            <div><label className={labelClass}>Tier</label><select className={inputClass} onChange={(event) => set({ tier: event.target.value })} value={form.tier}>{TIERS.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>Status</label><select className={inputClass} onChange={(event) => set({ status: event.target.value })} value={form.status}>{STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
            <div><label className={labelClass}>Tanggal Input</label><input className={inputClass} onChange={(event) => set({ input_date: event.target.value })} type="date" value={form.input_date} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>PIC</label><input className={inputClass} onChange={(event) => set({ contact_name: event.target.value })} value={form.contact_name} /></div>
            <div><label className={labelClass}>Jabatan PIC</label><input className={inputClass} onChange={(event) => set({ pos: event.target.value })} value={form.pos} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>WhatsApp</label><input className={inputClass} onChange={(event) => set({ contact_phone: event.target.value })} value={form.contact_phone} /></div>
            <div><label className={labelClass}>Email</label><input className={inputClass} onChange={(event) => set({ contact_email: event.target.value })} type="email" value={form.contact_email} /></div>
          </div>
          <div><label className={labelClass}>LinkedIn</label><input className={inputClass} onChange={(event) => set({ li: event.target.value })} placeholder="https://linkedin.com/..." value={form.li} /></div>
          <div><label className={labelClass}>Scope Kerjasama</label><textarea className={inputClass} onChange={(event) => set({ scope: event.target.value })} rows={2} value={form.scope} /></div>
          <div><label className={labelClass}>Catatan</label><textarea className={inputClass} onChange={(event) => set({ notes: event.target.value })} rows={2} value={form.notes} /></div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button onClick={onClose} size="sm" variant="outline">Batal</Button>
          <Button disabled={pending} onClick={save} size="sm"><i className="ti ti-check" /> Simpan</Button>
        </div>
      </Card>
    </div>
  );
}
