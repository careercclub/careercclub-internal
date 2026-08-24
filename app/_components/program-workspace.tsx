"use client";

import { addEventLinkAction, createEventAction, createTaskAction, deleteEventLinkAction, deleteTaskAction, updateEventAction, updateProgramTaskWorkflowAction, updateTaskDetailsAction } from "@/app/actions/program-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ApiRecord } from "@/lib/api/_crud";
import { useRouter } from "next/navigation";
import { type CSSProperties, useMemo, useState } from "react";
import { DashboardCalendar } from "./dashboard-calendar";
import { GoogleCalendarScript, useGoogleCalendarAction } from "./google-calendar-tool";
import { Pagination, usePagination } from "./ui-kit";
import styles from "../record-manager.module.css";

const JENIS = ["CCA", "Webinar", "Workshop", "Bootcamp", "Seminar"];
const EVENT_STATUS = ["Planning", "On Progress", "Done", "Cancelled"];
const PLATFORMS = ["Zoom", "Google Meet", "Offline"];
const PHASES = ["Pre Event", "Hari H", "Post Event"];
const TASK_STATUS = ["Todo", "On Progress", "Done"];
const PRIORITIES = ["High", "Med", "Low"];

function text(value: unknown) { return value === null || value === undefined ? "" : String(value); }
function dateKey(value: unknown) { if (!value) return ""; if (value instanceof Date) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`; return String(value).slice(0, 10); }
const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function fmtDate(value: unknown) { const key = dateKey(value); if (!key) return ""; const [y, m, d] = key.split("-"); return `${Number(d)} ${MONTHS_ID[Number(m) - 1] || m} ${y}`; }
function fmtShort(value: unknown) { const key = dateKey(value); if (!key) return "—"; const parts = key.split("-"); return `${Number(parts[2])} ${MONTHS_ID[Number(parts[1]) - 1] || parts[1]}`; }
function personName(people: ApiRecord[], id: string) { const person = people.find((row) => String(row.id) === id); return person ? text(person.nama) || text(person.name) || text(person.email) || id : id; }

const PILLS: Record<string, { bg: string; fg: string }> = {
  "On Progress": { bg: "var(--amber-bg)", fg: "var(--amber)" },
  Planning: { bg: "var(--bg)", fg: "var(--text-muted)" },
  Done: { bg: "var(--green-bg)", fg: "var(--green)" },
  Cancelled: { bg: "var(--red-bg)", fg: "var(--red)" },
  Todo: { bg: "var(--bg)", fg: "var(--text-muted)" },
  High: { bg: "var(--red-bg)", fg: "var(--red)" },
  Med: { bg: "var(--amber-bg)", fg: "var(--amber)" },
  Low: { bg: "var(--teal-bg)", fg: "var(--teal)" },
};
const pillBase: CSSProperties = { display: "inline-block", padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" };
function pill(value: string): CSSProperties { const c = PILLS[value] || { bg: "var(--bg)", fg: "var(--text-muted)" }; return { ...pillBase, background: c.bg, color: c.fg }; }
const jenisPill: CSSProperties = { ...pillBase, background: "var(--blue-bg)", color: "var(--blue)" };
function eventBorder(status: string) { return status === "On Progress" ? "#2563eb" : status === "Done" ? "#3b6d11" : status === "Cancelled" ? "var(--red)" : "var(--text-hint)"; }
const panelCard: CSSProperties = { background: "var(--white)", border: "0.5px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 16 };
const thStyle: CSSProperties = { padding: "8px 10px", fontWeight: 600, textAlign: "left", whiteSpace: "nowrap", color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase" };
const tdStyle: CSSProperties = { padding: "10px", verticalAlign: "middle" };

function AssigneeField({ people, value, onChange }: { people: ApiRecord[]; value: string[]; onChange: (ids: string[]) => void }) {
  const available = people.filter((person) => !value.includes(String(person.id)));
  return (
    <div className="grid gap-1.5">
      <Label>Assignee</Label>
      <div className="flex flex-wrap gap-1.5">
        {value.length ? value.map((id) => <Badge key={id} variant="secondary" className="gap-1 pr-1">{personName(people, id)}<button type="button" onClick={() => onChange(value.filter((current) => current !== id))} className="rounded-full px-1 leading-none hover:bg-black/10" aria-label="Hapus assignee">×</button></Badge>) : <span className="text-xs text-muted-foreground">Belum ada assignee</span>}
      </div>
      {available.length ? <Select key={value.length} value="" onValueChange={(id) => { if (id) onChange([...value, id]); }}><SelectTrigger><SelectValue placeholder="+ Tambah assignee…" /></SelectTrigger><SelectContent>{available.map((person) => <SelectItem key={String(person.id)} value={String(person.id)}>{text(person.nama) || text(person.name) || text(person.email)}</SelectItem>)}</SelectContent></Select> : null}
    </div>
  );
}

function EventFormModal({ event, onClose, onSaved }: { event: ApiRecord | null; onClose: () => void; onSaved: (row: ApiRecord) => void }) {
  const editing = !!event;
  const [form, setForm] = useState({ nama: text(event?.nama), jenisProgram: text(event?.jenis_program), tanggal: dateKey(event?.tanggal), waktu: text(event?.waktu).slice(0, 5), platform: text(event?.platform) || "Zoom", status: text(event?.status) || "Planning", speaker: text(event?.speaker), target: text(event?.target) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (!form.nama.trim()) { setError("Nama event wajib diisi."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.tanggal)) { setError("Tanggal wajib diisi."); return; }
    setBusy(true); setError("");
    try {
      const payload = { nama: form.nama, jenisProgram: form.jenisProgram || null, tanggal: form.tanggal, waktu: form.waktu || null, platform: form.platform, status: form.status, speaker: form.speaker || null, target: form.target || null };
      const row = editing ? await updateEventAction(String(event.id), payload) : await createEventAction(payload);
      onSaved(row);
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal menyimpan event."); setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><i className="ti ti-calendar-event" /> {editing ? "Edit Event" : "Event Baru"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>Nama Event *</Label><Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="contoh: Free Class: Insider Tips Lolos MT" /></div>
          <div className="grid gap-1.5"><Label>Jenis Program</Label><Select value={form.jenisProgram || "none"} onValueChange={(v) => setForm({ ...form, jenisProgram: v === "none" ? "" : v })}><SelectTrigger><SelectValue placeholder="— Pilih jenis —" /></SelectTrigger><SelectContent><SelectItem value="none">— Pilih jenis —</SelectItem>{JENIS.map((j) => <SelectItem key={j} value={j}>{j}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Tanggal *</Label><Input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>Waktu</Label><Input type="time" value={form.waktu} onChange={(e) => setForm({ ...form, waktu: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Platform</Label><Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EVENT_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid gap-1.5"><Label>Speaker</Label><Input value={form.speaker} onChange={(e) => setForm({ ...form, speaker: e.target.value })} placeholder="Nama speaker — Posisi/perusahaan" /></div>
          <div className="grid gap-1.5"><Label>Target Peserta</Label><Input type="number" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} /></div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="sm:justify-end"><Button type="button" variant="ghost" onClick={onClose}>Batal</Button><Button type="button" onClick={submit} disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskFormModal({ projectId, task, people, onClose, onSaved, onDeleted }: { projectId: string; task: ApiRecord | null; people: ApiRecord[]; onClose: () => void; onSaved: (row: ApiRecord) => void; onDeleted: (id: string) => void }) {
  const editing = !!task;
  const [form, setForm] = useState({ title: text(task?.title), description: text(task?.description), phase: text(task?.phase) || "Pre Event", status: text(task?.status) || "Todo", priority: text(task?.priority) || "Med", dueDate: dateKey(task?.due_date) });
  const [assignees, setAssignees] = useState<string[]>(Array.isArray(task?.assignee_ids) ? task.assignee_ids.map(String) : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (!form.title.trim()) { setError("Judul task wajib diisi."); return; }
    setBusy(true); setError("");
    try {
      if (editing && task) { await updateTaskDetailsAction(String(task.id), { title: form.title, description: form.description, status: form.status, priority: form.priority, phase: form.phase || undefined, dueDate: form.dueDate || null, assigneeIds: assignees }); onSaved({ ...task, ...form, due_date: form.dueDate, assignee_ids: assignees }); }
      else { const row = await createTaskAction({ projectId, title: form.title, description: form.description, phase: form.phase, status: form.status, priority: form.priority, dueDate: form.dueDate || null, assigneeIds: assignees }); onSaved(row); }
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal menyimpan task."); setBusy(false); }
  }
  async function remove() { if (!editing || !task || !window.confirm("Hapus task ini?")) return; setBusy(true); setError(""); try { await deleteTaskAction(String(task.id)); onDeleted(String(task.id)); } catch (e) { setError(e instanceof Error ? e.message : "Gagal menghapus."); setBusy(false); } }
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><i className="ti ti-checklist" /> {editing ? "Edit Task" : "Task Baru"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>Judul Task *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="contoh: Desain flyer & poster promo" /></div>
          <div className="grid gap-1.5"><Label>Deskripsi</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detail brief, requirement, dll…" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Phase</Label><Select value={form.phase} onValueChange={(v) => setForm({ ...form, phase: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PHASES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TASK_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Priority</Label><Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Deadline</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
          </div>
          <AssigneeField people={people} value={assignees} onChange={setAssignees} />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <div>{editing ? <Button type="button" variant="destructive" size="sm" onClick={remove} disabled={busy}><i className="ti ti-trash" /> Hapus</Button> : null}</div>
          <div className="flex gap-2"><Button type="button" variant="ghost" onClick={onClose}>Batal</Button><Button type="button" onClick={submit} disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</Button></div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddLinkModal({ eventId, onClose, onSaved }: { eventId: string; onClose: () => void; onSaved: (row: ApiRecord) => void }) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (!label.trim() || !url.trim()) { setError("Label & URL wajib diisi."); return; }
    setBusy(true); setError("");
    try { const row = await addEventLinkAction(eventId, { label: label.trim(), url: url.trim() }); onSaved(row); }
    catch (e) { setError(e instanceof Error ? e.message : "Gagal menambah link."); setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><i className="ti ti-link" /> Tambah Link</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>Label</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="contoh: Link Slido" /></div>
          <div className="grid gap-1.5"><Label>URL</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." /></div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="sm:justify-end"><Button type="button" variant="ghost" onClick={onClose}>Batal</Button><Button type="button" onClick={submit} disabled={busy}>{busy ? "Menyimpan…" : "Tambah"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EventLinksPanel({ event, templates, onAdd, onDelete, error }: { event: ApiRecord; templates: ApiRecord[]; onAdd: () => void; onDelete: (index: number) => void; error?: string }) {
  const [open, setOpen] = useState(false);
  const relevant = templates.filter((template) => text(template.jenis_program) === text(event.jenis_program));
  const adhoc = Array.isArray(event.links) ? (event.links as { label: string; url: string }[]) : [];
  const total = relevant.length + adhoc.length;
  const chip: CSSProperties = { ...pillBase, display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 20, maxWidth: 200 };
  return (
    <div style={panelCard}>
      <button type="button" onClick={() => setOpen((value) => !value)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
        <i className="ti ti-link" style={{ fontSize: 13, color: "var(--purple-accent)" }} />
        <span style={{ fontSize: 12, fontWeight: 700, flex: 1 }}>Links{total > 0 ? <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}> ({total})</span> : null}</span>
        <i className={`ti ti-chevron-${open ? "up" : "down"}`} style={{ fontSize: 13, color: "var(--text-muted)" }} />
      </button>
      {open ? (
        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {relevant.map((template) => (
            <a key={String(template.id)} href={text(template.url)} target="_blank" rel="noreferrer" title={text(template.label)} style={{ ...chip, border: "0.5px solid var(--border)", background: "var(--purple-light)", color: "var(--purple-mid)", textDecoration: "none" }}>
              <i className="ti ti-bookmark" style={{ fontSize: 11, color: "var(--purple-accent)" }} />
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{text(template.label)}</span>
            </a>
          ))}
          {adhoc.map((link, index) => (
            <span key={`${link.url}-${index}`} style={{ ...chip, border: "0.5px solid var(--border)", background: "var(--white)" }} title={link.label}>
              <a href={link.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, color: "inherit", textDecoration: "none", overflow: "hidden" }}>
                <i className="ti ti-link" style={{ fontSize: 11, color: "var(--text-muted)" }} />
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{link.label}</span>
              </a>
              <button type="button" onClick={() => onDelete(index)} aria-label="Hapus link" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex", flexShrink: 0, marginLeft: 2 }}><i className="ti ti-x" style={{ fontSize: 10 }} /></button>
            </span>
          ))}
          <button type="button" onClick={onAdd} style={{ ...chip, border: "0.5px dashed var(--border)", color: "var(--text-muted)", background: "none", cursor: "pointer" }}><i className="ti ti-plus" style={{ fontSize: 11 }} /><span style={{ whiteSpace: "nowrap" }}>Tambah link</span></button>
        </div>
      ) : null}
      {open && error ? <p style={{ fontSize: 11, color: "var(--red)", marginTop: 8 }}>{error}</p> : null}
    </div>
  );
}

function TaskCalendarModal({ task, people, onClose, onSynced }: { task: ApiRecord; people: ApiRecord[]; onClose: () => void; onSynced: (taskId: string) => void }) {
  const assigneeIds = Array.isArray(task.assignee_ids) ? task.assignee_ids.map(String) : [];
  const assigneePeople = people.filter((person) => assigneeIds.includes(String(person.id)) && person.email);
  const due = dateKey(task.due_date) || dateKey(task.created_at) || "";
  const [title, setTitle] = useState(text(task.title));
  const [startDate, setStartDate] = useState(due);
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState(due);
  const [endTime, setEndTime] = useState("10:00");
  const [invite, setInvite] = useState(true);
  const { run, busy, message, clientId, configurationLoaded } = useGoogleCalendarAction(() => { onSynced(String(task.id)); onClose(); });
  function submit() {
    if (!startDate || !endDate) return;
    run({ taskId: String(task.id), title, description: text(task.description), start: `${startDate}T${startTime}:00`, end: `${endDate}T${endTime}:00`, attendees: invite ? assigneePeople.map((person) => text(person.email)) : [] });
  }
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><i className="ti ti-brand-google" /> Tambah ke Google Calendar</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>Judul Event</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Mulai</Label><div className="flex gap-1"><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div></div>
            <div className="grid gap-1.5"><Label>Selesai</Label><div className="flex gap-1"><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div></div>
          </div>
          {assigneePeople.length ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={invite} onChange={(e) => setInvite(e.target.checked)} /> Undang {assigneePeople.map((person) => text(person.nama) || text(person.email)).join(", ")}</label> : null}
          {configurationLoaded && !clientId ? <p className="text-xs text-destructive">Google Calendar belum dikonfigurasi untuk aplikasi ini.</p> : null}
          {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
        </div>
        <DialogFooter className="sm:justify-end"><Button type="button" variant="ghost" onClick={onClose}>Batal</Button><Button type="button" onClick={submit} disabled={busy || !configurationLoaded || !clientId}>{busy ? "Menghubungkan…" : "Buat Event"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProgramWorkspace({ events, tasks, people = [], divisions = [], tickets = [], linkTemplates = [], referenceDate }: { events: ApiRecord[]; tasks: ApiRecord[]; people?: ApiRecord[]; divisions?: ApiRecord[]; tickets?: ApiRecord[]; linkTemplates?: ApiRecord[]; referenceDate: string }) {
  const router = useRouter();
  const [eventsState, setEventsState] = useState(events);
  const [taskRows, setTaskRows] = useState(tasks);
  const [tab, setTab] = useState<"overview" | "events" | "history" | "calendar">("overview");
  const [selectedEvent, setSelectedEvent] = useState(String(events.find((event) => event.status !== "Done")?.id || events[0]?.id || ""));
  const [phaseTab, setPhaseTab] = useState<string>("all");
  const [jenisFilter, setJenisFilter] = useState("");
  const [eventModal, setEventModal] = useState<{ event: ApiRecord | null } | null>(null);
  const [taskModal, setTaskModal] = useState<{ task: ApiRecord | null } | null>(null);
  const [linkModalEvent, setLinkModalEvent] = useState("");
  const [linkError, setLinkError] = useState("");
  const [gcalTask, setGcalTask] = useState<ApiRecord | null>(null);

  const personMap = useMemo(() => new Map(people.map((person) => [String(person.id), person])), [people]);
  const divisionMap = useMemo(() => new Map(divisions.map((division) => [String(division.id), division])), [divisions]);
  const overdue = taskRows.filter((task) => task.status !== "Done" && task.due_date && dateKey(task.due_date) < referenceDate.slice(0, 10)).length;
  const selected = eventsState.find((event) => String(event.id) === selectedEvent) || null;
  const jenisOptions = useMemo(() => [...new Set(eventsState.map((event) => text(event.jenis_program)).filter(Boolean))], [eventsState]);
  const overviewEvents = eventsState.filter((event) => !jenisFilter || text(event.jenis_program) === jenisFilter).slice().sort((a, b) => text(b.tanggal).localeCompare(text(a.tanggal)));
  const historyEvents = eventsState.filter((event) => ["Done", "Cancelled"].includes(text(event.status))).filter((event) => !jenisFilter || text(event.jenis_program) === jenisFilter);
  const selectedTasks = taskRows.filter((task) => String(task.project_id) === selectedEvent);
  const phaseTasks = selectedTasks.filter((task) => phaseTab === "all" || text(task.phase) === phaseTab);
  const { pageItems: phaseTaskPage, page: taskPage, setPage: setTaskPage, totalPages: taskTotalPages } = usePagination(phaseTasks, 10);

  function progressOf(eventId: string) { const related = taskRows.filter((task) => String(task.project_id) === eventId); const done = related.filter((task) => task.status === "Done").length; return { done, total: related.length, pct: related.length ? Math.round((done / related.length) * 100) : 0 }; }
  function assigneeOf(task: ApiRecord) { const ids = Array.isArray(task.assignee_ids) ? task.assignee_ids.map(String) : []; const person = ids.length ? personMap.get(ids[0]) : null; if (!person) return { name: "—", div: "" }; return { name: text(person.nama) || text(person.email), div: text(divisionMap.get(text(person.divisi_id))?.nama) }; }
  function toggleTask(task: ApiRecord) { const next = task.status === "Done" ? "Todo" : "Done"; const before = taskRows; setTaskRows((current) => current.map((row) => String(row.id) === String(task.id) ? { ...row, status: next } : row)); void updateProgramTaskWorkflowAction(String(task.id), { status: next }).catch(() => setTaskRows(before)); }
  async function deleteLink(eventId: string, index: number) {
    if (!window.confirm("Hapus link ini?")) return;
    setLinkError("");
    try {
      const row = await deleteEventLinkAction(eventId, index);
      setEventsState((current) => current.map((event) => String(event.id) === eventId ? row : event));
      router.refresh();
    } catch (e) { setLinkError(e instanceof Error ? e.message : "Gagal menghapus link."); }
  }

  return (
    <div className={styles.crmWorkspace}>
      <GoogleCalendarScript />
      <nav className={styles.workspaceTabs}>{([["overview", "Overview"], ["events", "Events"], ["history", "History"], ["calendar", "Calendar"]] as const).map(([id, label]) => <button className={tab === id ? styles.workspaceTabActive : styles.workspaceTab} key={id} onClick={() => setTab(id)} type="button">{label}</button>)}</nav>

      {tab === "overview" ? (
        <div className="grid gap-4">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
            <div style={panelCard}><div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Total Event</div><div style={{ fontSize: 26, fontWeight: 700 }}>{eventsState.length}</div></div>
            <div style={panelCard}><div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>On Progress</div><div style={{ fontSize: 26, fontWeight: 700, color: "var(--blue)" }}>{eventsState.filter((event) => event.status === "On Progress").length}</div></div>
            <div style={panelCard}><div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Planning</div><div style={{ fontSize: 26, fontWeight: 700, color: "var(--text-muted)" }}>{eventsState.filter((event) => event.status === "Planning").length}</div></div>
            <div style={panelCard}><div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Task Overdue</div><div style={{ fontSize: 26, fontWeight: 700, color: "var(--red)" }}>{overdue}</div></div>
          </div>
          <div style={panelCard}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <div><strong style={{ fontSize: 14 }}>Semua Event</strong><div style={{ fontSize: 11, color: "var(--text-muted)" }}>Klik card untuk lihat detail tasks & timeline</div></div>
              <div style={{ display: "flex", gap: 8 }}><Select value={jenisFilter || "all"} onValueChange={(v) => setJenisFilter(v === "all" ? "" : v)}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua Jenis</SelectItem>{jenisOptions.map((j) => <SelectItem key={j} value={j}>{j}</SelectItem>)}</SelectContent></Select><Button type="button" onClick={() => setEventModal({ event: null })}><i className="ti ti-plus" /> Event Baru</Button></div>
            </div>
            <div className="grid gap-3">
              {overviewEvents.map((event) => { const p = progressOf(String(event.id)); return (
                <button type="button" key={String(event.id)} onClick={() => { setSelectedEvent(String(event.id)); setPhaseTab("all"); setTab("events"); }} style={{ textAlign: "left", background: "var(--white)", border: "0.5px solid var(--border)", borderLeft: `4px solid ${eventBorder(text(event.status))}`, borderRadius: 10, padding: 14, cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}><strong style={{ fontSize: 14 }}>{text(event.nama) || "Untitled"}</strong><span style={pill(text(event.status) || "Planning")}>{text(event.status) || "Planning"}</span>{event.jenis_program ? <span style={jenisPill}>{text(event.jenis_program)}</span> : null}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}><i className="ti ti-calendar" /> {fmtDate(event.tanggal) || "No date"}{event.waktu ? ` · ${text(event.waktu).slice(0, 5)}` : ""}{event.speaker ? ` · ${text(event.speaker)}` : ""}</div>
                  <div style={{ height: 6, borderRadius: 4, background: "var(--bg)", overflow: "hidden" }}><div style={{ height: "100%", width: `${p.pct}%`, background: eventBorder(text(event.status)) }} /></div>
                  <div style={{ textAlign: "right", fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{p.done}/{p.total} task · {p.pct}%</div>
                </button>
              ); })}
              {overviewEvents.length === 0 ? <p style={{ fontSize: 12, color: "var(--text-muted)", padding: 12 }}>Belum ada event.</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "events" ? (
        <div className="grid gap-4">
          <div style={{ display: "flex", gap: 8 }}>
            <Select value={selectedEvent || "none"} onValueChange={(v) => { setSelectedEvent(v === "none" ? "" : v); setPhaseTab("all"); }}><SelectTrigger className="flex-1"><SelectValue placeholder="Pilih event" /></SelectTrigger><SelectContent><SelectItem value="none">Pilih event</SelectItem>{eventsState.map((event) => <SelectItem key={String(event.id)} value={String(event.id)}>{text(event.nama) || "Untitled"}</SelectItem>)}</SelectContent></Select>
            <Button type="button" disabled={!selectedEvent} onClick={() => setTaskModal({ task: null })}><i className="ti ti-plus" /> Task</Button>
          </div>
          {selected ? (
            <>
              <div style={panelCard}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div><div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><strong style={{ fontSize: 16 }}>{text(selected.nama)}</strong><span style={pill(text(selected.status) || "Planning")}>{text(selected.status) || "Planning"}</span>{selected.jenis_program ? <span style={jenisPill}>{text(selected.jenis_program)}</span> : null}</div><div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}><i className="ti ti-calendar" /> {fmtDate(selected.tanggal)}{selected.waktu ? ` · ${text(selected.waktu).slice(0, 5)}` : ""}{selected.speaker ? ` · ${text(selected.speaker)}` : ""}</div></div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEventModal({ event: selected })}><i className="ti ti-edit" /> Edit</Button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{([["all", `Semua (${selectedTasks.length})`], ...PHASES.map((phase) => [phase, `${phase} (${selectedTasks.filter((task) => text(task.phase) === phase).length})`])] as [string, string][]).map(([id, label]) => <button key={id} type="button" onClick={() => setPhaseTab(id)} style={{ ...pillBase, padding: "5px 12px", cursor: "pointer", border: `1px solid ${phaseTab === id ? "var(--purple-mid)" : "var(--border-md)"}`, background: phaseTab === id ? "var(--purple-light)" : "var(--white)", color: phaseTab === id ? "var(--purple-mid)" : "var(--text-muted)" }}>{label}</button>)}</div>
              <EventLinksPanel event={selected} templates={linkTemplates} onAdd={() => { setLinkError(""); setLinkModalEvent(String(selected.id)); }} onDelete={(index) => deleteLink(String(selected.id), index)} error={linkError} />
              <div style={{ ...panelCard, padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "10px 12px", borderBottom: "0.5px solid var(--border)", fontSize: 12 }}><span style={pill("Todo")}>{phaseTab === "all" ? "Semua" : phaseTab}</span> <span style={{ color: "var(--text-muted)" }}>{phaseTasks.length} task · {phaseTasks.filter((task) => task.status === "Done").length} done</span></div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead><tr style={{ background: "var(--bg)" }}><th style={thStyle} /><th style={thStyle}>Task</th><th style={thStyle}>Assignee</th><th style={thStyle}>Deadline</th><th style={thStyle}>Status</th><th style={thStyle}>Priority</th><th style={{ ...thStyle, textAlign: "center" }}>Aksi</th></tr></thead>
                    <tbody>
                      {phaseTasks.length === 0 ? <tr><td colSpan={7} style={{ padding: 28, textAlign: "center", color: "var(--text-muted)" }}>Belum ada task. Klik &quot;+ Task&quot; untuk menambah.</td></tr> : phaseTaskPage.map((task) => { const isDone = task.status === "Done"; const who = assigneeOf(task); const synced = Boolean(task.gcal_added); return (
                        <tr key={String(task.id)} onClick={() => setTaskModal({ task })} style={{ borderBottom: "0.5px solid var(--border)", cursor: "pointer" }}>
                          <td style={tdStyle} onClick={(e) => { e.stopPropagation(); toggleTask(task); }}><div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${isDone ? "#0f52ba" : "var(--border-md)"}`, background: isDone ? "#0f52ba" : "transparent", display: "grid", placeItems: "center" }}>{isDone ? <i className="ti ti-check" style={{ fontSize: 10, color: "#fff" }} /> : null}</div></td>
                          <td style={{ ...tdStyle, textDecoration: isDone ? "line-through" : "none", color: isDone ? "var(--text-muted)" : "var(--text)" }}>{text(task.title) || "Untitled"}</td>
                          <td style={tdStyle}><div style={{ fontWeight: 500 }}>{who.name}</div>{who.div ? <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{who.div}</div> : null}</td>
                          <td style={{ ...tdStyle, fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmtShort(task.due_date)}</td>
                          <td style={tdStyle}><span style={pill(text(task.status) || "Todo")}>{text(task.status) || "Todo"}</span></td>
                          <td style={tdStyle}><span style={pill(text(task.priority) || "Med")}>{text(task.priority) || "Med"}</span></td>
                          <td style={{ ...tdStyle, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                            <Button type="button" size="icon-sm" variant="outline" style={synced ? { background: "var(--green)", borderColor: "var(--green)", color: "#fff" } : undefined} title={synced ? "Sudah di Calendar (klik untuk re-sync)" : "Add to Google Calendar"} onClick={() => setGcalTask(task)}>
                              <i className={`ti ti-calendar-${synced ? "check" : "plus"}`} />
                            </Button>
                          </td>
                        </tr>
                      ); })}
                    </tbody>
                  </table>
                </div>
                <Pagination onChange={setTaskPage} page={taskPage} totalPages={taskTotalPages} />
              </div>
            </>
          ) : <p style={{ fontSize: 12, color: "var(--text-muted)", padding: 12 }}>Pilih event untuk melihat & mengelola task-nya.</p>}
        </div>
      ) : null}

      {tab === "history" ? (
        <div className="grid gap-4">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}><span style={{ fontSize: 12, color: "var(--text-muted)" }}>{historyEvents.length} event selesai/dibatalkan</span><Select value={jenisFilter || "all"} onValueChange={(v) => setJenisFilter(v === "all" ? "" : v)}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua Jenis</SelectItem>{jenisOptions.map((j) => <SelectItem key={j} value={j}>{j}</SelectItem>)}</SelectContent></Select></div>
          {historyEvents.map((event) => { const related = taskRows.filter((task) => String(task.project_id) === String(event.id)); const done = related.filter((task) => task.status === "Done").length; const pct = related.length ? Math.round((done / related.length) * 100) : 0; return (
            <details key={String(event.id)} style={panelCard}>
              <summary style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, cursor: "pointer", listStyle: "none" }}>
                <div><div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><strong style={{ fontSize: 14 }}>{text(event.nama)}</strong>{event.jenis_program ? <span style={jenisPill}>{text(event.jenis_program)}</span> : null}<span style={pill(text(event.status))}>{text(event.status)}</span></div><div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{fmtDate(event.tanggal)} · {text(event.platform) || "-"}</div></div>
                <div style={{ textAlign: "right" }}><div style={{ fontSize: 16, fontWeight: 700, color: "var(--green)" }}>{pct}%</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{done}/{related.length} task</div></div>
              </summary>
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {PHASES.map((phase) => { const pt = related.filter((task) => text(task.phase) === phase); if (!pt.length) return null; return (
                  <div key={phase}><div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>{phase}</div>{pt.map((task) => <div key={String(task.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "5px 0", borderBottom: "0.5px solid var(--border)" }}><span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 15, height: 15, borderRadius: 4, background: task.status === "Done" ? "#0f52ba" : "var(--bg)", display: "grid", placeItems: "center" }}>{task.status === "Done" ? <i className="ti ti-check" style={{ fontSize: 9, color: "#fff" }} /> : null}</span><span style={{ fontSize: 12, textDecoration: task.status === "Done" ? "line-through" : "none", color: "var(--text-muted)" }}>{text(task.title)}</span></span><span style={pill(text(task.status) || "Todo")}>{text(task.status) || "Todo"}</span></div>)}</div>
                ); })}
              </div>
            </details>
          ); })}
          {historyEvents.length === 0 ? <p style={{ fontSize: 12, color: "var(--text-muted)", padding: 12 }}>Belum ada event selesai.</p> : null}
        </div>
      ) : null}

      {tab === "calendar" ? <DashboardCalendar tickets={tickets} tasks={taskRows} events={eventsState} people={people} divisions={divisions} referenceDate={referenceDate} /> : null}

      {eventModal ? <EventFormModal event={eventModal.event} onClose={() => setEventModal(null)} onSaved={(row) => { setEventsState((current) => eventModal.event ? current.map((event) => String(event.id) === String(row.id) ? row : event) : [row, ...current]); if (!eventModal.event) setSelectedEvent(String(row.id)); setEventModal(null); router.refresh(); }} /> : null}
      {taskModal && selectedEvent ? <TaskFormModal projectId={selectedEvent} task={taskModal.task} people={people} onClose={() => setTaskModal(null)} onSaved={(row) => { setTaskRows((current) => taskModal.task ? current.map((task) => String(task.id) === String(row.id) ? row : task) : [row, ...current]); setTaskModal(null); router.refresh(); }} onDeleted={(id) => { setTaskRows((current) => current.filter((task) => String(task.id) !== id)); setTaskModal(null); router.refresh(); }} /> : null}
      {linkModalEvent ? <AddLinkModal eventId={linkModalEvent} onClose={() => setLinkModalEvent("")} onSaved={(row) => { setEventsState((current) => current.map((event) => String(event.id) === String(row.id) ? row : event)); setLinkModalEvent(""); router.refresh(); }} /> : null}
      {gcalTask ? <TaskCalendarModal task={gcalTask} people={people} onClose={() => setGcalTask(null)} onSynced={(taskId) => setTaskRows((current) => current.map((row) => String(row.id) === taskId ? { ...row, gcal_added: true } : row))} /> : null}
    </div>
  );
}
