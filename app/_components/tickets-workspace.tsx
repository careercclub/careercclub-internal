"use client";

import { addTicketLinkAction, changeTicketStatusAction, createTicketAction, deleteTicketAction, duplicateTicketAction, updateTicketDetailsAction } from "@/app/actions/ticket-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ApiRecord } from "@/lib/api/_crud";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, type ReactNode, useMemo, useState } from "react";
import { AssigneeField, personName } from "./assignee-field";
import { GoogleCalendarScript } from "./google-calendar-tool";
import { TicketGoogleCalendarModal } from "./ticket-google-calendar-modal";
import { Pagination, usePagination } from "./ui-kit";

const PRIORITIES = ["High", "Med", "Low"];

function text(value: unknown) { return value === null || value === undefined ? "" : String(value); }
function initials(name: string) { return name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase() || "?"; }
// jsonb columns written before the sql.json() fix hold a JSON *string* rather than an
// array — and the append path produced an array of such strings. Unwrap both so
// existing tickets keep rendering their links without a data migration.
function arr(value: unknown): Record<string, unknown>[] {
  if (typeof value === "string") { try { return arr(JSON.parse(value)); } catch { return []; } }
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => (typeof item === "string" ? arr(item) : item && typeof item === "object" ? [item as Record<string, unknown>] : []));
}
function calendarAdded(row: ApiRecord) { return row.gcal_added === true || row.gcal_added === "true"; }

const PILL_COLORS: Record<string, { bg: string; fg: string }> = {
  Todo: { bg: "var(--bg)", fg: "var(--text-muted)" },
  "In Progress": { bg: "var(--blue-bg)", fg: "var(--blue)" },
  Done: { bg: "var(--green-bg)", fg: "var(--green)" },
  High: { bg: "var(--red-bg)", fg: "var(--red)" },
  Med: { bg: "var(--amber-bg)", fg: "var(--amber)" },
  Low: { bg: "var(--teal-bg)", fg: "var(--teal)" },
};
const DIV_COLORS = [["#fbeaf0", "#993556"], ["#e6f1fb", "#185fa5"], ["#eaf3de", "#3b6d11"], ["#faeeda", "#854f0b"], ["#e1f5ee", "#0f6e56"], ["#eeedfe", "#534ab7"], ["#faece7", "#993c1d"]];
const pillBase: CSSProperties = { display: "inline-block", padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" };
function pill(value: string): CSSProperties { const c = PILL_COLORS[value] || { bg: "var(--bg)", fg: "var(--text-muted)" }; return { ...pillBase, background: c.bg, color: c.fg }; }
function divPill(index: number): CSSProperties { const [bg, fg] = DIV_COLORS[index % DIV_COLORS.length]; return { ...pillBase, background: bg, color: fg }; }

const panelCard: CSSProperties = { background: "var(--white)", border: "0.5px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" };
const ghostBtnStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 12px", border: "0.5px solid var(--border-md)", borderRadius: 8, background: "var(--white)", fontSize: 12, color: "var(--text)", whiteSpace: "nowrap", flexShrink: 0 };
const thStyle: CSSProperties = { padding: "8px 10px", fontWeight: 600, textAlign: "center", whiteSpace: "nowrap" };
const tdStyle: CSSProperties = { padding: "10px", verticalAlign: "middle" };
function tabStyle(active: boolean): CSSProperties { return { padding: "6px 14px", borderRadius: 0, border: 0, background: "transparent", fontSize: 13, fontWeight: 600, color: active ? "var(--purple-mid)" : "var(--text-muted)", borderBottom: active ? "2px solid var(--purple-mid)" : "2px solid transparent", cursor: "pointer" }; }

function StatCard({ icon, color, bg, value, label }: { icon: string; color: string; bg: string; value: number; label: string }) {
  return <div style={{ ...panelCard, display: "flex", alignItems: "center", gap: 12, padding: 14 }}><div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: "grid", placeItems: "center", flexShrink: 0 }}><i className={`ti ${icon}`} style={{ color, fontSize: 18 }} /></div><div><div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</div></div></div>;
}


function CreateTicketModal({ people, divisions, types, onClose, onCreated }: { people: ApiRecord[]; divisions: ApiRecord[]; types: ApiRecord[]; onClose: () => void; onCreated: (row: ApiRecord) => void }) {
  const [form, setForm] = useState({ title: "", description: "", priority: "Med", divisionId: "", typeId: "", dueDate: "" });
  const [assignees, setAssignees] = useState<string[]>([]);
  const [linkUrl, setLinkUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (!form.title.trim()) { setError("Judul ticket wajib diisi."); return; }
    setBusy(true); setError("");
    try {
      const row = await createTicketAction({ title: form.title, description: form.description, status: "Todo", priority: form.priority, divisionId: form.divisionId || null, typeId: form.typeId || null, dueDate: form.dueDate || null, assignedToIds: assignees, links: linkUrl.trim() ? [{ label: "Link", url: linkUrl.trim() }] : [] });
      onCreated(row);
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal membuat ticket."); setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><i className="ti ti-ticket" /> Buat Ticket</DialogTitle><DialogDescription>Request ke divisi atau assignee tertentu.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>Judul Ticket</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="contoh: Desain flyer CCA" /></div>
          <div className="grid gap-1.5"><Label>Deskripsi</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Divisi</Label><Select value={form.divisionId || "none"} onValueChange={(v) => setForm({ ...form, divisionId: v === "none" ? "" : v })}><SelectTrigger><SelectValue placeholder="Pilih divisi" /></SelectTrigger><SelectContent><SelectItem value="none">— Pilih divisi —</SelectItem>{divisions.map((d) => <SelectItem key={String(d.id)} value={String(d.id)}>{text(d.nama)}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Tipe Request</Label><Select value={form.typeId || "none"} onValueChange={(v) => setForm({ ...form, typeId: v === "none" ? "" : v })}><SelectTrigger><SelectValue placeholder="Pilih tipe" /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem>{types.map((t) => <SelectItem key={String(t.id)} value={String(t.id)}>{text(t.nama)}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Prioritas</Label><Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Deadline</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
          </div>
          <AssigneeField people={people} value={assignees} onChange={setAssignees} />
          <div className="grid gap-1.5"><Label>Link (opsional)</Label><Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." /></div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="sm:justify-end"><Button type="button" variant="ghost" onClick={onClose}>Batal</Button><Button type="button" onClick={submit} disabled={busy}>{busy ? "Menyimpan…" : "Buat Ticket"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailTicketModal({ ticket, people, divisions, onClose, onSaved, onDeleted, onDuplicated, onCalendar }: { ticket: ApiRecord; people: ApiRecord[]; divisions: ApiRecord[]; onClose: () => void; onSaved: (row: ApiRecord) => void; onDeleted: (id: string) => void; onDuplicated: (row: ApiRecord) => void; onCalendar: () => void }) {
  const [form, setForm] = useState({ title: text(ticket.title), description: text(ticket.description), status: text(ticket.status) || "Todo", priority: text(ticket.priority) || "Med", dueDate: text(ticket.due_date).slice(0, 10) });
  const [divisionId, setDivisionId] = useState(text(ticket.divisi_id));
  const [assignees, setAssignees] = useState<string[]>(Array.isArray(ticket.assigned_to_ids) ? ticket.assigned_to_ids.map(String) : []);
  const [linkUrl, setLinkUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const links = arr(ticket.links);
  const synced = calendarAdded(ticket);
  async function save() {
    setBusy(true); setError("");
    try {
      const updated = await updateTicketDetailsAction(String(ticket.id), { title: form.title, description: form.description, status: form.status, priority: form.priority, dueDate: form.dueDate || null, assignedToIds: assignees, divisionId: divisionId || null, typeId: ticket.type_id ?? null, cc: Array.isArray(ticket.cc) ? ticket.cc.join(",") : text(ticket.cc) });
      onSaved({ ...ticket, ...updated });
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal menyimpan."); } finally { setBusy(false); }
  }
  async function addLink() {
    const url = linkUrl.trim(); if (!url) return;
    setBusy(true); setError("");
    try { const fd = new FormData(); fd.set("url", url); fd.set("label", "Link"); await addTicketLinkAction(String(ticket.id), fd); onSaved({ ...ticket, links: [...links, { label: "Link", url }] }); setLinkUrl(""); } catch (e) { setError(e instanceof Error ? e.message : "Gagal menambah link."); } finally { setBusy(false); }
  }
  async function remove() { if (!window.confirm("Hapus ticket ini?")) return; setBusy(true); setError(""); try { await deleteTicketAction(String(ticket.id)); onDeleted(String(ticket.id)); } catch (e) { setError(e instanceof Error ? e.message : "Gagal menghapus."); setBusy(false); } }
  async function duplicate() { setBusy(true); setError(""); try { const row = await duplicateTicketAction(String(ticket.id)); onDuplicated(row); onClose(); } catch (e) { setError(e instanceof Error ? e.message : "Gagal menduplikat."); setBusy(false); } }
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><i className="ti ti-ticket" /> Detail Ticket</DialogTitle>{ticket.ticket_no ? <DialogDescription>#{text(ticket.ticket_no)}</DialogDescription> : null}</DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>Judul Ticket</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Deskripsi</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Todo", "In Progress", "Done"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Prioritas</Label><Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Divisi</Label><Select value={divisionId || "none"} onValueChange={(v) => setDivisionId(v === "none" ? "" : v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem>{divisions.map((d) => <SelectItem key={String(d.id)} value={String(d.id)}>{text(d.nama)}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Deadline</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
          </div>
          <AssigneeField people={people} value={assignees} onChange={setAssignees} />
          <div className="grid gap-1.5">
            <Label>Lampiran &amp; Link</Label>
            {links.map((link, index) => <a key={index} href={text(link.url)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-primary underline truncate"><i className="ti ti-link" /> {text(link.label) || text(link.url)}</a>)}
            <div className="flex gap-2"><Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." /><Button type="button" variant="outline" size="sm" onClick={addLink} disabled={busy || !linkUrl.trim()}>Tambah</Button></div>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={onCalendar} disabled={busy} style={synced ? { background: "var(--green)", borderColor: "var(--green)", color: "#fff" } : undefined}><i className={`ti ti-calendar-${synced ? "check" : "plus"}`} /> {synced ? "Re-sync Calendar" : "Google Calendar"}</Button><Button type="button" variant="outline" size="sm" onClick={duplicate} disabled={busy}><i className="ti ti-copy" /> Duplikat</Button><Button type="button" variant="destructive" size="sm" onClick={remove} disabled={busy}><i className="ti ti-trash" /> Hapus</Button></div>
          <div className="flex gap-2"><Button type="button" variant="ghost" onClick={onClose}>Batal</Button><Button type="button" onClick={save} disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</Button></div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TicketsWorkspace({ rows, people, divisions, types, aiPanel }: { rows: ApiRecord[]; people: ApiRecord[]; divisions: ApiRecord[]; types: ApiRecord[]; aiPanel: ReactNode }) {
  const router = useRouter();
  const [items, setItems] = useState(rows);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "todo" | "done">("all");
  const [fDiv, setFDiv] = useState("");
  const [fPrio, setFPrio] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [calendarId, setCalendarId] = useState<string | null>(null);

  const personMap = useMemo(() => new Map(people.map((person) => [String(person.id), person])), [people]);
  const divisionMap = useMemo(() => new Map(divisions.map((division) => [String(division.id), division])), [divisions]);
  const divisionIndex = useMemo(() => new Map(divisions.map((division, index) => [String(division.id), index])), [divisions]);
  const typeMap = useMemo(() => new Map(types.map((type) => [String(type.id), type])), [types]);

  const todo = items.filter((row) => row.status === "Todo").length;
  const done = items.filter((row) => row.status === "Done").length;
  const visible = items.filter((row) => {
    if (tab === "todo" && row.status !== "Todo") return false;
    if (tab === "done" && row.status !== "Done") return false;
    if (query && !`${text(row.ticket_no)} ${text(row.title)} ${text(row.description)}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (fDiv && text(row.divisi_id) !== fDiv) return false;
    if (fPrio && text(row.priority) !== fPrio) return false;
    return true;
  });
  const { pageItems: visiblePage, page: ticketPage, setPage: setTicketPage, totalPages: ticketTotalPages } = usePagination(visible, 15);
  const detail = items.find((row) => String(row.id) === detailId) || null;
  const calendarTicket = items.find((row) => String(row.id) === calendarId) || null;

  function firstAssignee(row: ApiRecord) {
    const ids = Array.isArray(row.assigned_to_ids) ? row.assigned_to_ids.map(String) : row.assigned_to_id ? [String(row.assigned_to_id)] : [];
    const person = ids.length ? personMap.get(ids[0]) : null;
    return person ? text(person.nama) || text(person.email) : "—";
  }
  async function toggleDone(row: ApiRecord) {
    const next = row.status === "Done" ? "Todo" : "Done";
    const before = items;
    setItems((current) => current.map((item) => String(item.id) === String(row.id) ? { ...item, status: next } : item));
    try { await changeTicketStatusAction(String(row.id), next); } catch { setItems(before); }
  }

  return (
    <div className="grid gap-4">
      <GoogleCalendarScript />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        <StatCard icon="ti-circle-dashed" color="#5F5E5A" bg="#F1EFE8" value={todo} label="Todo" />
        <StatCard icon="ti-circle-check" color="#3B6D11" bg="#EAF3DE" value={done} label="Done" />
      </div>
      {aiPanel}
      <div style={panelCard}>
        <div style={{ padding: 12, borderBottom: "0.5px solid var(--border)", display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 4 }}>{([["all", "Semua"], ["todo", "Todo"], ["done", "Done"]] as const).map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} style={tabStyle(tab === id)}>{label}</button>)}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Input placeholder="Cari ticket..." value={query} onChange={(e) => setQuery(e.target.value)} className="min-w-[160px] flex-1" />
            <Button type="button" onClick={() => setCreateOpen(true)}><i className="ti ti-plus" /> Buat Ticket</Button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Select value={fDiv || "all"} onValueChange={(v) => setFDiv(v === "all" ? "" : v)}><SelectTrigger className="min-w-[140px] flex-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua divisi</SelectItem>{divisions.map((d) => <SelectItem key={String(d.id)} value={String(d.id)}>{text(d.nama)}</SelectItem>)}</SelectContent></Select>
            <Select value={fPrio || "all"} onValueChange={(v) => setFPrio(v === "all" ? "" : v)}><SelectTrigger className="min-w-[140px] flex-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua prioritas</SelectItem>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
            <Link href="/tickets/divisions" style={ghostBtnStyle}><i className="ti ti-adjustments" /> Master Data</Link>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg)", color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase" }}>
                <th style={thStyle} /><th style={thStyle}>ID</th><th style={{ ...thStyle, textAlign: "left" }}>Judul &amp; Deskripsi</th><th style={thStyle}>Divisi</th><th style={thStyle}>Prioritas</th><th style={thStyle}>Status</th><th style={{ ...thStyle, textAlign: "left" }}>Assignee</th><th style={thStyle}>Tanggal</th><th style={thStyle} />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? <tr><td colSpan={9} style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}><i className="ti ti-inbox" style={{ fontSize: 28, display: "block", marginBottom: 8 }} />Tidak ada ticket ditemukan</td></tr> : visiblePage.map((row) => {
                const isDone = row.status === "Done";
                const divId = text(row.divisi_id);
                const division = divisionMap.get(divId);
                const type = typeMap.get(text(row.type_id));
                const att = arr(row.files).length + arr(row.links).length;
                const synced = calendarAdded(row);
                return (
                  <tr key={String(row.id)} onClick={() => setDetailId(String(row.id))} style={{ borderBottom: "0.5px solid var(--border)", cursor: "pointer", opacity: isDone ? 0.5 : 1 }}>
                    <td style={tdStyle} onClick={(e) => { e.stopPropagation(); void toggleDone(row); }}><div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${isDone ? "#0f52ba" : "var(--border-md)"}`, background: isDone ? "#0f52ba" : "transparent", display: "grid", placeItems: "center", margin: "0 auto" }}>{isDone ? <i className="ti ti-check" style={{ fontSize: 10, color: "#fff" }} /> : null}</div></td>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{text(row.ticket_no) || String(row.id).slice(0, 6)}</td>
                    <td style={tdStyle}><div style={{ fontWeight: 500, textDecoration: isDone ? "line-through" : "none" }}>{text(row.title) || "—"}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{type ? text(type.nama) : ""}{att > 0 ? ` · 📎 ${att}` : ""}</div></td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{division ? <span style={divPill(divisionIndex.get(divId) ?? 0)}>{text(division.nama)}</span> : <span style={{ color: "var(--text-hint)" }}>—</span>}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}><span style={pill(text(row.priority) || "Med")}>{text(row.priority) || "Med"}</span></td>
                    <td style={{ ...tdStyle, textAlign: "center" }}><span style={pill(text(row.status) || "Todo")}>{text(row.status) || "Todo"}</span></td>
                    <td style={tdStyle}><div style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}><span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--purple-dark)", color: "#fff", fontSize: 9, display: "grid", placeItems: "center", flexShrink: 0 }}>{initials(firstAssignee(row))}</span>{firstAssignee(row)}</div></td>
                    <td style={{ ...tdStyle, fontSize: 11, color: "var(--text-muted)", textAlign: "center", whiteSpace: "nowrap" }}>{text(row.due_date).slice(0, 10) || "—"}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }} onClick={(event) => event.stopPropagation()}><Button type="button" size="icon-sm" variant="outline" style={synced ? { background: "var(--green)", borderColor: "var(--green)", color: "#fff" } : undefined} title={synced ? "Sudah di Calendar (klik untuk re-sync)" : "Add to Google Calendar"} onClick={() => setCalendarId(String(row.id))}><i className={`ti ti-calendar-${synced ? "check" : "plus"}`} /></Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination onChange={setTicketPage} page={ticketPage} totalPages={ticketTotalPages} />
      </div>
      {createOpen ? <CreateTicketModal people={people} divisions={divisions} types={types} onClose={() => setCreateOpen(false)} onCreated={(row) => { setItems((current) => [row, ...current]); setCreateOpen(false); router.refresh(); }} /> : null}
      {detail ? <DetailTicketModal ticket={detail} people={people} divisions={divisions} onClose={() => setDetailId(null)} onSaved={(row) => { setItems((current) => current.map((item) => String(item.id) === String(row.id) ? row : item)); router.refresh(); }} onDeleted={(id) => { setItems((current) => current.filter((item) => String(item.id) !== id)); setDetailId(null); router.refresh(); }} onDuplicated={(row) => { setItems((current) => [row, ...current]); router.refresh(); }} onCalendar={() => { setCalendarId(String(detail.id)); setDetailId(null); }} /> : null}
      {calendarTicket ? <TicketGoogleCalendarModal key={String(calendarTicket.id)} ticket={calendarTicket} people={people} onClose={() => setCalendarId(null)} onSynced={(row) => { setItems((current) => current.map((item) => String(item.id) === String(row.id) ? row : item)); router.refresh(); }} /> : null}
    </div>
  );
}
