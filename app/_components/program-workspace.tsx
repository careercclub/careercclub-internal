"use client";

import { createEventAction, createTaskAction, updateProgramTaskWorkflowAction } from "@/app/actions/program-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ApiRecord } from "@/lib/api/_crud";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useMemo, useState, useTransition } from "react";
import styles from "../record-manager.module.css";

const statuses = ["Todo", "On Progress", "Done"] as const;
const JENIS = ["CCA", "Webinar", "Workshop", "Bootcamp", "Seminar"];
const EVENT_STATUS = ["Planning", "On Progress", "Done", "Cancelled"];
const PLATFORMS = ["Zoom", "Google Meet", "Offline"];
const PHASES = ["Pre Event", "Hari H", "Post Event"];
const PRIORITIES = ["High", "Med", "Low"];
function iso(date: Date) { return date.toISOString().slice(0, 10); }
function text(value: unknown) { return value === null || value === undefined ? "" : String(value); }
function personName(people: ApiRecord[], id: string) { const person = people.find((row) => String(row.id) === id); return person ? text(person.nama) || text(person.name) || text(person.email) || id : id; }

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

function EventModal({ onClose, onCreated }: { onClose: () => void; onCreated: (row: ApiRecord) => void }) {
  const [form, setForm] = useState({ nama: "", jenisProgram: "", tanggal: "", waktu: "", platform: "Zoom", status: "Planning", speaker: "", target: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (!form.nama.trim()) { setError("Nama event wajib diisi."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.tanggal)) { setError("Tanggal wajib diisi."); return; }
    setBusy(true); setError("");
    try { const row = await createEventAction({ nama: form.nama, jenisProgram: form.jenisProgram || null, tanggal: form.tanggal, waktu: form.waktu || null, platform: form.platform, status: form.status, speaker: form.speaker || null, target: form.target || null }); onCreated(row); }
    catch (e) { setError(e instanceof Error ? e.message : "Gagal membuat event."); setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><i className="ti ti-calendar-event" /> Event Baru</DialogTitle></DialogHeader>
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

function TaskModal({ projectId, people, onClose, onCreated }: { projectId: string; people: ApiRecord[]; onClose: () => void; onCreated: (row: ApiRecord) => void }) {
  const [form, setForm] = useState({ title: "", description: "", phase: "Pre Event", status: "Todo", priority: "Med", dueDate: "" });
  const [assignees, setAssignees] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (!form.title.trim()) { setError("Judul task wajib diisi."); return; }
    setBusy(true); setError("");
    try { const row = await createTaskAction({ projectId, title: form.title, description: form.description, phase: form.phase, status: form.status, priority: form.priority, dueDate: form.dueDate || null, assigneeIds: assignees }); onCreated(row); }
    catch (e) { setError(e instanceof Error ? e.message : "Gagal membuat task."); setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><i className="ti ti-checklist" /> Task Baru</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>Judul Task *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="contoh: Desain flyer & poster promo" /></div>
          <div className="grid gap-1.5"><Label>Deskripsi</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detail brief, requirement, dll…" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Phase</Label><Select value={form.phase} onValueChange={(v) => setForm({ ...form, phase: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PHASES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Priority</Label><Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Deadline</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
          </div>
          <AssigneeField people={people} value={assignees} onChange={setAssignees} />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="sm:justify-end"><Button type="button" variant="ghost" onClick={onClose}>Batal</Button><Button type="button" onClick={submit} disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProgramWorkspace({ events, tasks, people = [], referenceDate, tools, management }: { events: ApiRecord[]; tasks: ApiRecord[]; people?: ApiRecord[]; referenceDate: string; tools: ReactNode; management: ReactNode }) {
  const router = useRouter();
  const [eventsState, setEventsState] = useState(events);
  const [taskRows, setTaskRows] = useState(tasks);
  const [tab, setTab] = useState<"overview" | "events" | "history" | "calendar" | "tools">("overview");
  const [selectedEvent, setSelectedEvent] = useState(String(events.find((event) => event.status !== "Done")?.id || events[0]?.id || ""));
  const [monthOffset, setMonthOffset] = useState(0);
  const [pending, startTransition] = useTransition();
  const [eventModal, setEventModal] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const activeEvents = eventsState.filter((event) => !["Done", "Cancelled"].includes(String(event.status)));
  const eventTasks = taskRows.filter((task) => !selectedEvent || String(task.project_id) === selectedEvent);
  const overdue = taskRows.filter((task) => task.status !== "Done" && task.due_date && String(task.due_date).slice(0, 10) < referenceDate.slice(0, 10)).length;
  const calendar = useMemo(() => { const base = new Date(referenceDate); const first = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1, 12); const start = new Date(first); start.setDate(1 - first.getDay()); return { label: first.toLocaleDateString("en", { month: "long", year: "numeric" }), days: Array.from({ length: 42 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day; }) }; }, [referenceDate, monthOffset]);
  function move(id: string, change: { status?: string; dueDate?: string }) { const before = taskRows; setTaskRows((current) => current.map((task) => String(task.id) === id ? { ...task, ...(change.status ? { status: change.status } : {}), ...(change.dueDate ? { due_date: change.dueDate } : {}) } : task)); startTransition(async () => { try { await updateProgramTaskWorkflowAction(id, change); } catch { setTaskRows(before); } }); }

  return <div className={styles.crmWorkspace}>
    <div className={styles.workspaceHeader}><div><p>Program</p><h1>Program operations</h1><span>Events, execution tasks, progress, rundown, links, and calendar scheduling.</span></div><Button type="button" onClick={() => setEventModal(true)}><i className="ti ti-plus" /> Event Baru</Button></div>
    <div className={styles.metricStrip}><div><strong>{eventsState.length}</strong><span>Total events</span></div><div><strong>{activeEvents.length}</strong><span>Active</span></div><div><strong>{eventsState.filter((event) => event.status === "Planning").length}</strong><span>Planning</span></div><div><strong>{overdue}</strong><span>Overdue tasks</span></div><div><strong>{taskRows.filter((task) => task.status === "Done").length}/{taskRows.length}</strong><span>Tasks done</span></div></div>
    <nav className={styles.workspaceTabs}>{([['overview','Overview'],['events','Events'],['history','History'],['calendar','Calendar'],['tools','Tools']] as const).map(([id,label]) => <button className={tab === id ? styles.workspaceTabActive : styles.workspaceTab} key={id} onClick={() => setTab(id)} type="button">{label}</button>)}</nav>
    {tab === "overview" ? <><div className={styles.filterBar}><select value={selectedEvent} onChange={(event) => setSelectedEvent(event.target.value)}><option value="">All programs</option>{eventsState.map((event) => <option key={String(event.id)} value={String(event.id)}>{String(event.nama || "Untitled")}</option>)}</select><Button type="button" variant="outline" size="sm" disabled={!selectedEvent} onClick={() => setTaskModal(true)}><i className="ti ti-plus" /> Task</Button><Link className={styles.secondaryButton} href="/program/rundown">Edit rundown</Link><Link className={styles.secondaryButton} href="/program/link-templates">Event links</Link>{pending ? <span className={styles.formMessage}>Saving workflow...</span> : null}</div><div className={styles.taskKanban}>{statuses.map((status) => <section key={status} onDragOver={(event) => event.preventDefault()} onDrop={(event) => move(event.dataTransfer.getData("task-id"), { status })}><header><strong>{status}</strong><span>{eventTasks.filter((task) => String(task.status || "Todo") === status).length}</span></header>{eventTasks.filter((task) => String(task.status || "Todo") === status).map((task) => <article draggable key={String(task.id)} onDragStart={(event) => event.dataTransfer.setData("task-id", String(task.id))}><strong>{String(task.title || "Untitled")}</strong><p>{String(task.description || "No description")}</p><div><span className={styles.dataPill}>{String(task.phase || "Pre Event")}</span><span className={styles.dataPill}>{String(task.priority || "Med")}</span></div><small>{String(task.due_date || "No deadline")}</small><select value={String(task.status || "Todo")} onChange={(event) => move(String(task.id), { status: event.target.value })}>{statuses.map((option) => <option key={option}>{option}</option>)}</select></article>)}</section>)}</div></> : null}
    {tab === "events" ? <div className={styles.summaryGrid}>{activeEvents.map((event) => { const related = taskRows.filter((task) => String(task.project_id) === String(event.id)); const done = related.filter((task) => task.status === "Done").length; return <article key={String(event.id)}><header><strong>{String(event.nama || "Untitled")}</strong><span>{String(event.status || "Planning")}</span></header><p>{String(event.tanggal || "No date")} · {String(event.platform || "-")}<br />{String(event.speaker || "No speaker")}</p><progress max={Math.max(related.length,1)} value={done} /><footer><span>{done}/{related.length} tasks</span><button className={styles.secondaryButton} onClick={() => { setSelectedEvent(String(event.id)); setTab("overview"); }} type="button">Open workflow</button></footer></article>; })}</div> : null}
    {tab === "history" ? <div className={styles.summaryGrid}>{eventsState.filter((event) => ["Done","Cancelled"].includes(String(event.status))).map((event) => <article key={String(event.id)}><header><strong>{String(event.nama || "Untitled")}</strong><span>{String(event.status)}</span></header><p>{String(event.tanggal || "-")} · target {String(event.target || "-")} · achieved {String(event.capaian_peserta || "-")}</p><footer><span>{String(event.notes_post || "No post-event notes")}</span></footer></article>)}</div> : null}
    {tab === "calendar" ? <div className={styles.programCalendar}><div className={styles.calendarToolbar}><strong>{calendar.label}</strong><div><button onClick={() => setMonthOffset((value) => value - 1)}><i className="ti ti-chevron-left" /></button><button onClick={() => setMonthOffset(0)}>Today</button><button onClick={() => setMonthOffset((value) => value + 1)}><i className="ti ti-chevron-right" /></button></div></div><div className={styles.monthCalendar}>{calendar.days.map((day) => { const key = iso(day); return <section key={key} onDragOver={(event) => event.preventDefault()} onDrop={(event) => move(event.dataTransfer.getData("task-id"), { dueDate: key })}><header>{day.getDate()}</header>{eventsState.filter((item) => String(item.tanggal || "").slice(0,10) === key).map((item) => <span className={styles.calendarEvent} key={String(item.id)}>{String(item.nama)}</span>)}{taskRows.filter((item) => String(item.due_date || "").slice(0,10) === key).map((item) => <span className={styles.calendarTask} draggable key={String(item.id)} onDragStart={(event) => event.dataTransfer.setData("task-id", String(item.id))}>{String(item.title)}</span>)}</section>; })}</div></div> : null}
    {tab === "tools" ? <div className={styles.toolStack}>{tools}{management}</div> : null}
    {eventModal ? <EventModal onClose={() => setEventModal(false)} onCreated={(row) => { setEventsState((current) => [row, ...current]); setSelectedEvent(String(row.id)); setEventModal(false); router.refresh(); }} /> : null}
    {taskModal && selectedEvent ? <TaskModal projectId={selectedEvent} people={people} onClose={() => setTaskModal(false)} onCreated={(row) => { setTaskRows((current) => [row, ...current]); setTaskModal(false); router.refresh(); }} /> : null}
  </div>;
}
