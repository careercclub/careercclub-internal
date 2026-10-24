"use client";

import { revertWith } from "./safe-action";

import { addEventLinkAction, createEventAction, createTaskAction, deleteEventLinkAction, deleteTaskAction, updateEventAction, updateProgramTaskWorkflowAction, updateTaskDetailsAction } from "@/app/actions/program-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ApiRecord } from "@/lib/api/_crud";
import { useRouter } from "next/navigation";
import { type CSSProperties, useMemo, useState } from "react";
import { AssigneeField, personName } from "./assignee-field";
import { DashboardCalendar } from "./dashboard-calendar";
import { EventRundown } from "./event-rundown";
import { GoogleCalendarScript, useGoogleCalendarAction } from "./google-calendar-tool";
import { Pagination, ShowMoreList, usePagination } from "./ui-kit";
import styles from "../record-manager.module.css";
import { useRecordFocus } from "./use-record-focus";
import { confirmAction } from "./app-dialog";
import ps from "./program-workspace.module.css";
import { dueChip } from "@/lib/tickets/groups";
import { isOverdue, localIso } from "@/lib/dashboard/summary";
import { DateInput, TimeInput } from "./date-input";

const JENIS = ["CCA", "Webinar", "Workshop", "Bootcamp", "Seminar"];
const EVENT_STATUS = ["Planning", "On Progress", "Done", "Cancelled"];
const PLATFORMS = ["Zoom", "Google Meet", "Offline"];
const PHASES = ["Pre Event", "Hari H", "Post Event"];
// Stored phase values stay as they are; this is the English display label.
const PHASE_LABEL: Record<string, string> = { "Pre Event": "Pre-event", "Hari H": "Event day", "Post Event": "Post-event" };
const phaseLabel = (value: string) => PHASE_LABEL[value] || value;
const TASK_STATUS = ["Todo", "On Progress", "Done"];
const PRIORITIES = ["High", "Med", "Low"];

function text(value: unknown) { return value === null || value === undefined ? "" : String(value); }
function dateKey(value: unknown) { if (!value) return ""; if (value instanceof Date) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`; return String(value).slice(0, 10); }
const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(value: unknown) { const key = dateKey(value); if (!key) return ""; const [y, m, d] = key.split("-"); return `${Number(d)} ${MONTHS_ID[Number(m) - 1] || m} ${y}`; }
function fmtShort(value: unknown) { const key = dateKey(value); if (!key) return "—"; const parts = key.split("-"); return `${Number(parts[2])} ${MONTHS_ID[Number(parts[1]) - 1] || parts[1]}`; }

const panelCard: CSSProperties = { background: "var(--white)", border: "0.5px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 16 };


function EventFormModal({ event, onClose, onSaved }: { event: ApiRecord | null; onClose: () => void; onSaved: (row: ApiRecord) => void }) {
  const editing = !!event;
  const [form, setForm] = useState({ nama: text(event?.nama), jenisProgram: text(event?.jenis_program), tanggal: dateKey(event?.tanggal), waktu: text(event?.waktu).slice(0, 5), platform: text(event?.platform) || "Zoom", status: text(event?.status) || "Planning", speaker: text(event?.speaker), target: text(event?.target) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (!form.nama.trim()) { setError("Event name is required."); document.getElementById("event-name")?.focus(); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.tanggal)) { setError("Date is required."); document.getElementById("event-date")?.focus(); return; }
    setBusy(true); setError("");
    try {
      const payload = { nama: form.nama, jenisProgram: form.jenisProgram || null, tanggal: form.tanggal, waktu: form.waktu || null, platform: form.platform, status: form.status, speaker: form.speaker || null, target: form.target || null };
      const row = editing ? await updateEventAction(String(event.id), payload) : await createEventAction(payload);
      onSaved(row);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save the event."); setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><i className="ti ti-calendar-event" /> {editing ? "Edit event" : "Add event"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label htmlFor="event-name">Event name <span className="text-[var(--red)]">*</span></Label><Input aria-invalid={Boolean(error) && !form.nama.trim()} id="event-name" required value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="e.g. Free Class: insider tips to pass MT selection" /></div>
          <div className="grid gap-1.5"><Label>Program type</Label><Select value={form.jenisProgram || "none"} onValueChange={(v) => setForm({ ...form, jenisProgram: v === "none" ? "" : v })}><SelectTrigger><SelectValue placeholder="Select program type" /></SelectTrigger><SelectContent><SelectItem value="none">Select program type</SelectItem>{JENIS.map((j) => <SelectItem key={j} value={j}>{j}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label htmlFor="event-date">Date <span className="text-[var(--red)]">*</span></Label><DateInput as={Input} aria-invalid={Boolean(error) && !form.tanggal} id="event-date" required  value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>Time</Label><TimeInput aria-label="Event time" as={Input} value={form.waktu} onChange={(e) => setForm({ ...form, waktu: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Platform</Label><Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EVENT_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid gap-1.5"><Label>Speaker</Label><Input value={form.speaker} onChange={(e) => setForm({ ...form, speaker: e.target.value })} placeholder="Speaker name — position/company" /></div>
          <div className="grid gap-1.5"><Label>Target participants</Label><Input type="number" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} /></div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter sticky className="sm:justify-end"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="button" onClick={submit} disabled={busy}>{busy ? "Saving…" : editing ? "Save event" : "Add event"}</Button></DialogFooter>
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
    if (!form.title.trim()) { setError("Task title is required."); document.getElementById("task-title")?.focus(); return; }
    setBusy(true); setError("");
    try {
      if (editing && task) { await updateTaskDetailsAction(String(task.id), { title: form.title, description: form.description, status: form.status, priority: form.priority, phase: form.phase || undefined, dueDate: form.dueDate || null, assigneeIds: assignees }); onSaved({ ...task, ...form, due_date: form.dueDate, assignee_ids: assignees }); }
      else { const row = await createTaskAction({ projectId, title: form.title, description: form.description, phase: form.phase, status: form.status, priority: form.priority, dueDate: form.dueDate || null, assigneeIds: assignees }); onSaved(row); }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save the task."); setBusy(false); }
  }
  async function remove() { if (!editing || !task || !(await confirmAction({ title: "Delete this task?", message: "A linked ticket is deleted too. This cannot be undone.", confirmLabel: "Delete task", danger: true }))) return; setBusy(true); setError(""); try { await deleteTaskAction(String(task.id)); onDeleted(String(task.id)); } catch (e) { setError(e instanceof Error ? e.message : "Could not delete."); setBusy(false); } }
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><i className="ti ti-checklist" /> {editing ? "Edit task" : "New task"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label htmlFor="task-title">Task title <span className="text-[var(--red)]">*</span></Label><Input aria-invalid={Boolean(error) && !form.title.trim()} id="task-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Promo flyer & poster design" /></div>
          <div className="grid gap-1.5"><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detail brief, requirement, dll…" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Phase</Label><Select value={form.phase} onValueChange={(v) => setForm({ ...form, phase: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PHASES.map((p) => <SelectItem key={p} value={p}>{phaseLabel(p)}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TASK_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Priority</Label><Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Deadline</Label><DateInput as={Input} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
          </div>
          <AssigneeField people={people} value={assignees} onChange={setAssignees} />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter sticky className="flex-row flex-wrap justify-between gap-2 sm:justify-between">
          <div>{editing ? <Button type="button" variant="destructive" size="sm" onClick={remove} disabled={busy}><i className="ti ti-trash" /> Delete</Button> : null}</div>
          <div className="flex gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="button" onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save task"}</Button></div>
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
    if (!label.trim() || !url.trim()) { setError("Label and URL are required."); if (!label.trim()) document.getElementById("event-link-label")?.focus(); else document.getElementById("event-link-url")?.focus(); return; }
    setBusy(true); setError("");
    try { const row = await addEventLinkAction(eventId, { label: label.trim(), url: url.trim() }); onSaved(row); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not add the link."); setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><i className="ti ti-link" /> Add link</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label htmlFor="event-link-label">Label <span className="text-[var(--red)]">*</span></Label><Input aria-invalid={Boolean(error) && !label.trim()} id="event-link-label" required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Slido link" /></div>
          <div className="grid gap-1.5"><Label htmlFor="event-link-url">URL <span className="text-[var(--red)]">*</span></Label><Input aria-invalid={Boolean(error) && !url.trim()} id="event-link-url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." /></div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter sticky className="sm:justify-end"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="button" onClick={submit} disabled={busy}>{busy ? "Saving…" : "Add link"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EventLinksPanel({ event, templates, onAdd, onDelete, error }: { event: ApiRecord; templates: ApiRecord[]; onAdd: () => void; onDelete: (index: number) => void; error?: string }) {
  const [open, setOpen] = useState(false);
  const relevant = templates.filter((template) => text(template.jenis_program) === text(event.jenis_program));
  const adhoc = Array.isArray(event.links) ? (event.links as { label: string; url: string }[]) : [];
  const total = relevant.length + adhoc.length;
  const chip: CSSProperties = { fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 20, maxWidth: 200 };
  return (
    <div style={panelCard}>
      <button type="button" onClick={() => setOpen((value) => !value)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
        <i className="ti ti-link" style={{ fontSize: 13, color: "var(--purple-accent)" }} />
        <span style={{ fontSize: 12, fontWeight: 700, flex: 1 }}>Links{total > 0 ? <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}> ({total})</span> : null}</span>
        <i className={`ti ti-chevron-${open ? "up" : "down"}`} style={{ fontSize: 13, color: "var(--text-muted)" }} />
      </button>
      {open ? (
        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {relevant.map((template) => (
            <a key={String(template.id)} href={text(template.url)} target="_blank" rel="noreferrer" title={text(template.label)} style={{ ...chip, border: "0.5px solid var(--border)", background: "var(--purple-light)", color: "var(--purple-mid)", textDecoration: "none" }}>
              <i className="ti ti-bookmark" style={{ fontSize: 12, color: "var(--purple-accent)" }} />
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{text(template.label)}</span>
            </a>
          ))}
          {adhoc.map((link, index) => (
            <span key={`${link.url}-${index}`} style={{ ...chip, border: "0.5px solid var(--border)", background: "var(--white)" }} title={link.label}>
              <a href={link.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, color: "inherit", textDecoration: "none", overflow: "hidden" }}>
                <i className="ti ti-link" style={{ fontSize: 12, color: "var(--text-muted)" }} />
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{link.label}</span>
              </a>
              <button type="button" onClick={() => onDelete(index)} aria-label="Delete link" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex", flexShrink: 0, marginLeft: 2 }}><i className="ti ti-x" style={{ fontSize: 12 }} /></button>
            </span>
          ))}
          <button type="button" onClick={onAdd} style={{ ...chip, border: "0.5px dashed var(--border)", color: "var(--text-muted)", background: "none", cursor: "pointer" }}><i className="ti ti-plus" style={{ fontSize: 12 }} /><span style={{ whiteSpace: "nowrap" }}>Add link</span></button>
        </div>
      ) : null}
      {open && error ? <p style={{ fontSize: 12, color: "var(--red)", marginTop: 8 }}>{error}</p> : null}
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
        <DialogHeader><DialogTitle className="flex items-center gap-2"><i className="ti ti-brand-google" /> Add to Google Calendar</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>Event title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Start</Label><div className="flex gap-1"><DateInput aria-label="Start date" as={Input} value={startDate} onChange={(e) => setStartDate(e.target.value)} /><TimeInput aria-label="Start time" as={Input} value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div></div>
            <div className="grid gap-1.5"><Label>Finished</Label><div className="flex gap-1"><DateInput aria-label="Finish date" as={Input} value={endDate} onChange={(e) => setEndDate(e.target.value)} /><TimeInput aria-label="Finish time" as={Input} value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div></div>
          </div>
          {assigneePeople.length ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={invite} onChange={(e) => setInvite(e.target.checked)} /> Undang {assigneePeople.map((person) => text(person.nama) || text(person.email)).join(", ")}</label> : null}
          {configurationLoaded && !clientId ? <p className="text-xs text-destructive">Google Calendar is not set up for this app yet.</p> : null}
          {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
        </div>
        <DialogFooter sticky className="sm:justify-end"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="button" onClick={submit} disabled={busy || !configurationLoaded || !clientId}>{busy ? "Connecting…" : "Add event"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProgramWorkspace({ events, tasks, people = [], divisions = [], tickets = [], linkTemplates = [], rundown = [], referenceDate }: { events: ApiRecord[]; tasks: ApiRecord[]; people?: ApiRecord[]; divisions?: ApiRecord[]; tickets?: ApiRecord[]; linkTemplates?: ApiRecord[]; rundown?: ApiRecord[]; referenceDate: string }) {
  const router = useRouter();
  const [eventsState, setEventsState] = useState(events);
  const [taskRows, setTaskRows] = useState(tasks);
  const [tab, setTab] = useState<"upcoming" | "finished" | "calendar">("upcoming");
  const [selectedEvent, setSelectedEvent] = useState(String(events.find((event) => event.status !== "Done")?.id || events[0]?.id || ""));
  const [phaseTab, setPhaseTab] = useState<string>("all");
  const [jenisFilter, setJenisFilter] = useState("");
  const [dateFrom, setDateFrom] = useState(""); const [dateTo, setDateTo] = useState("");
  useRecordFocus((id) => {
    if (!events.some((event) => String(event.id) === id)) return;
    const event = events.find((row) => String(row.id) === id);
    setSelectedEvent(id); setPhaseTab("all"); setJenisFilter(""); setDateFrom(""); setDateTo("");
    setTab(event && ["Done", "Cancelled"].includes(text(event.status)) ? "finished" : "upcoming");
    return true;
  });
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
  // The server returns events newest-first, but creating or editing one appends to
  // local state and breaks that order. Sorting once here keeps every list — picker,
  // overview and history — on the same newest-first ordering. Undated events sort
  // last rather than jumping to the top on an empty string compare.
  const sortedEvents = useMemo(() => [...eventsState].sort((a, b) => {
    const left = text(a.tanggal), right = text(b.tanggal);
    if (!left) return 1;
    if (!right) return -1;
    return right.localeCompare(left);
  }), [eventsState]);
  // Date keys are YYYY-MM-DD, so a string compare is a correct range test. An event
  // with no date is only hidden once a bound is actually set, so an empty filter never
  // silently drops undated events.
  const inDateRange = (event: ApiRecord) => {
    if (!dateFrom && !dateTo) return true;
    const key = dateKey(event.tanggal);
    if (!key) return false;
    return (!dateFrom || key >= dateFrom) && (!dateTo || key <= dateTo);
  };
  const matchesFilters = (event: ApiRecord) => (!jenisFilter || text(event.jenis_program) === jenisFilter) && inDateRange(event);
  const overviewEvents = sortedEvents.filter(matchesFilters);
  const historyEvents = sortedEvents.filter((event) => ["Done", "Cancelled"].includes(text(event.status))).filter(matchesFilters);
  const selectedTasks = taskRows.filter((task) => String(task.project_id) === selectedEvent);
  const phaseTasks = selectedTasks.filter((task) => phaseTab === "all" || text(task.phase) === phaseTab);
  const { pageItems: phaseTaskPage, page: taskPage, setPage: setTaskPage, totalPages: taskTotalPages } = usePagination(phaseTasks, 10);

  function progressOf(eventId: string) { const related = taskRows.filter((task) => String(task.project_id) === eventId); const done = related.filter((task) => task.status === "Done").length; return { done, total: related.length, pct: related.length ? Math.round((done / related.length) * 100) : 0 }; }
  function assigneeOf(task: ApiRecord) { const ids = Array.isArray(task.assignee_ids) ? task.assignee_ids.map(String) : []; const person = ids.length ? personMap.get(ids[0]) : null; if (!person) return { name: "—", div: "" }; return { name: text(person.nama) || text(person.email), div: text(divisionMap.get(text(person.divisi_id))?.nama) }; }
  function toggleTask(task: ApiRecord) { const next = task.status === "Done" ? "Todo" : "Done"; const before = taskRows; setTaskRows((current) => current.map((row) => String(row.id) === String(task.id) ? { ...row, status: next } : row)); void updateProgramTaskWorkflowAction(String(task.id), { status: next }).catch(revertWith(() => setTaskRows(before), "Could not change the task status.")); }
  async function deleteLink(eventId: string, index: number) {
    if (!(await confirmAction({ title: "Delete this link?", confirmLabel: "Delete link", danger: true }))) return;
    setLinkError("");
    try {
      const row = await deleteEventLinkAction(eventId, index);
      setEventsState((current) => current.map((event) => String(event.id) === eventId ? row : event));
      router.refresh();
    } catch (e) { setLinkError(e instanceof Error ? e.message : "Could not delete the link."); }
  }

  const today = localIso(new Date());
  const upcomingEvents = sortedEvents.filter((event) => !["Done", "Cancelled"].includes(text(event.status))).filter(matchesFilters)
    // Soonest first for what is coming; undated last.
    .sort((a, b) => (dateKey(a.tanggal) || "9999").localeCompare(dateKey(b.tanggal) || "9999"));
  const listEvents = tab === "finished" ? historyEvents : upcomingEvents;
  const shown = listEvents.find((event) => String(event.id) === selectedEvent) || listEvents[0] || null;
  const shownId = shown ? String(shown.id) : "";
  const shownTasks = taskRows.filter((task) => String(task.project_id) === shownId);
  const shownProgress = shown ? progressOf(shownId) : { done: 0, total: 0, pct: 0 };
  const lateTasks = taskRows.filter((task) => isOverdue(task, today)).length;
  const filtersOn = Boolean(jenisFilter || dateFrom || dateTo);

  return (
    <div className={ps.page}>
      <GoogleCalendarScript />
      <header className={ps.head}>
        <div>
          <span className={ps.eyebrow}>Operations</span>
          <h1>Program</h1>
          <p>{upcomingEvents.length} upcoming{lateTasks ? <> · <b className={ps.lateText}>{lateTasks} late {lateTasks === 1 ? "task" : "tasks"}</b></> : null}</p>
        </div>
        <Button type="button" onClick={() => setEventModal({ event: null })}><i className="ti ti-plus" aria-hidden="true" /> Add event</Button>
      </header>

      <div className={ps.toolbar}>
        <div className={ps.segmented} role="tablist" aria-label="Program view">
          {([["upcoming", "Upcoming", upcomingEvents.length], ["finished", "Finished", historyEvents.length], ["calendar", "Calendar", null]] as const).map(([id, label, count]) => (
            <button aria-selected={tab === id} className={tab === id ? ps.segmentActive : ps.segment} key={id} onClick={() => setTab(id)} role="tab" type="button">{label}{count !== null ? <span>{count}</span> : null}</button>
          ))}
        </div>
        {tab !== "calendar" ? (
          <>
            <label className={ps.filterPill}><span>Type</span><select aria-label="Filter program type" value={jenisFilter} onChange={(e) => setJenisFilter(e.target.value)}><option value="">All</option>{jenisOptions.map((j) => <option key={j} value={j}>{j}</option>)}</select></label>
            <label className={ps.filterPill}><span>From</span><DateInput aria-label="From date" onChange={(e) => setDateFrom(e.target.value)}  value={dateFrom} /></label>
            <label className={ps.filterPill}><span>To</span><DateInput aria-label="To date" onChange={(e) => setDateTo(e.target.value)}  value={dateTo} /></label>
            {filtersOn ? <button className={ps.clear} onClick={() => { setDateFrom(""); setDateTo(""); setJenisFilter(""); }} type="button">Clear filters</button> : null}
          </>
        ) : null}
      </div>

      {tab === "calendar" ? <div className={ps.calendarPanel}><DashboardCalendar tickets={tickets} tasks={taskRows} events={eventsState} people={people} divisions={divisions} referenceDate={referenceDate} /></div> : (
        <div className={ps.board}>
          <nav className={ps.eventList} aria-label={tab === "finished" ? "Finished events" : "Upcoming events"}>
            {listEvents.length ? listEvents.map((event) => {
              const id = String(event.id); const p = progressOf(id); const active = id === shownId;
              return (
                <button aria-current={active ? "true" : undefined} className={active ? ps.eventActive : ps.event} data-record-id={id} key={id} onClick={() => { setSelectedEvent(id); setPhaseTab("all"); }} type="button">
                  <span className={ps.ring} style={{ ["--pct" as string]: `${p.pct}%` }} aria-hidden="true"><span>{p.total ? `${p.pct}%` : "–"}</span></span>
                  <span className={ps.eventText}>
                    <b>{text(event.nama) || "Untitled event"}</b>
                    <small>{[text(event.jenis_program), fmtDate(event.tanggal) || "No date"].filter(Boolean).join(" · ")}</small>
                  </span>
                  <span className={ps.eventCount}>{p.done}/{p.total}</span>
                </button>
              );
            }) : <p className={ps.empty}>{filtersOn ? "No events match the filters." : tab === "finished" ? "No finished events yet." : "No upcoming events. Click Add event to plan one."}</p>}
          </nav>

          {shown ? (
            <section className={ps.detail} aria-label={text(shown.nama) || "Event"}>
              <div className={ps.detailHead}>
                <div className={ps.detailTitle}>
                  <span className={ps.eyebrow}>{text(shown.jenis_program) || "Program"}{["Done", "Cancelled"].includes(text(shown.status)) ? ` · ${text(shown.status)}` : ""}</span>
                  <h2>{text(shown.nama) || "Untitled event"}</h2>
                  <p>{[fmtDate(shown.tanggal) || "No date", text(shown.waktu).slice(0, 5), text(shown.platform), text(shown.speaker)].filter(Boolean).join(" · ")}</p>
                </div>
                <div className={ps.detailActions}>
                  <Button type="button" variant="outline" onClick={() => setEventModal({ event: shown })}><i className="ti ti-edit" aria-hidden="true" /> Edit event</Button>
                  <Button type="button" onClick={() => { setSelectedEvent(shownId); setTaskModal({ task: null }); }}><i className="ti ti-plus" aria-hidden="true" /> Add task</Button>
                </div>
              </div>
              <div className={ps.progress} aria-label={`${shownProgress.done} of ${shownProgress.total} tasks done`}>
                <span><b>{shownProgress.done}/{shownProgress.total}</b> tasks done</span>
                <span className={ps.bar}><span style={{ width: `${shownProgress.pct}%` }} /></span>
              </div>
              <EventLinksPanel event={shown} templates={linkTemplates} onAdd={() => { setLinkError(""); setLinkModalEvent(shownId); }} onDelete={(index) => deleteLink(shownId, index)} error={linkError} />

              <div className={ps.phaseTabs} role="tablist" aria-label="Task phase">
                {([["all", "All", shownTasks.length], ...PHASES.map((phase) => [phase, phaseLabel(phase), shownTasks.filter((task) => text(task.phase) === phase).length])] as [string, string, number][]).map(([id, label, count]) => (
                  <button aria-selected={phaseTab === id} className={phaseTab === id ? ps.phaseActive : ps.phase} key={id} onClick={() => setPhaseTab(id)} role="tab" type="button">{label} <span>{count}</span></button>
                ))}
              </div>
              {shownTasks.length === 0 ? <p className={ps.empty}>No tasks yet. Click Add task to plan the work.</p> : (phaseTab === "all" ? PHASES : [phaseTab]).map((phase) => {
                const list = shownTasks.filter((task) => text(task.phase) === phase).sort((a, b) => (dateKey(a.due_date) || "9999").localeCompare(dateKey(b.due_date) || "9999"));
                if (!list.length) return null;
                return (
                  <div className={ps.phaseGroup} key={phase}>
                    {phaseTab === "all" ? <h3>{phaseLabel(phase)} <span>{list.filter((task) => task.status === "Done").length}/{list.length}</span></h3> : null}
                    <ul className={ps.rows}>
                      <ShowMoreList items={list} step={12} noun="tasks" inList>{(visibleItems) => visibleItems.map((task) => {
                        const isDoneTask = task.status === "Done"; const who = assigneeOf(task); const synced = Boolean(task.gcal_added); const chip = dueChip(task, today); const title = text(task.title) || "Untitled task";
                        return (
                          <li className={isDoneTask ? ps.rowDone : ps.row} key={String(task.id)}>
                            <button aria-label={isDoneTask ? `Reopen task: ${title}` : `Mark task done: ${title}`} aria-pressed={isDoneTask} className={isDoneTask ? ps.checkOn : ps.check} onClick={() => toggleTask(task)} type="button"><i className="ti ti-check" aria-hidden="true" /></button>
                            <button className={ps.rowMain} onClick={() => { setSelectedEvent(shownId); setTaskModal({ task }); }} type="button">
                              <b>{title}</b>
                              <small>{[who.div, text(task.status) === "On Progress" ? "In progress" : "", text(task.priority) === "High" ? "High priority" : ""].filter(Boolean).join(" · ") || "\u00a0"}</small>
                            </button>
                            <span className={who.name === "—" ? ps.avatarEmpty : ps.avatar} title={who.name === "—" ? "No assignee" : who.name}>{who.name === "—" ? "?" : who.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
                            {chip ? <span className={chip.tone === "late" ? ps.chipLate : chip.tone === "soon" ? ps.chipSoon : ps.chip}>{chip.label}</span> : <span className={ps.chipNone}>No date</span>}
                            <button aria-label={synced ? `Re-sync ${title} to Google Calendar` : `Add ${title} to Google Calendar`} className={synced ? ps.calOn : ps.cal} onClick={() => setGcalTask(task)} title={synced ? "On Google Calendar (click to re-sync)" : "Add to Google Calendar"} type="button"><i className={`ti ti-calendar-${synced ? "check" : "plus"}`} aria-hidden="true" /></button>
                          </li>
                        );
                      })}</ShowMoreList>
                    </ul>
                  </div>
                );
              })}
              <div className={ps.rundown}><EventRundown eventId={shownId} rows={rundown} secondary startTime={text(shown.waktu).slice(0, 5)} /></div>
            </section>
          ) : null}
        </div>
      )}

      {eventModal ? <EventFormModal event={eventModal.event} onClose={() => setEventModal(null)} onSaved={(row) => { setEventsState((current) => eventModal.event ? current.map((event) => String(event.id) === String(row.id) ? row : event) : [row, ...current]); if (!eventModal.event) setSelectedEvent(String(row.id)); setEventModal(null); router.refresh(); }} /> : null}
      {taskModal && (selectedEvent || shownId) ? <TaskFormModal projectId={selectedEvent || shownId} task={taskModal.task} people={people} onClose={() => setTaskModal(null)} onSaved={(row) => { setTaskRows((current) => taskModal.task ? current.map((task) => String(task.id) === String(row.id) ? row : task) : [row, ...current]); setTaskModal(null); router.refresh(); }} onDeleted={(id) => { setTaskRows((current) => current.filter((task) => String(task.id) !== id)); setTaskModal(null); router.refresh(); }} /> : null}
      {linkModalEvent ? <AddLinkModal eventId={linkModalEvent} onClose={() => setLinkModalEvent("")} onSaved={(row) => { setEventsState((current) => current.map((event) => String(event.id) === String(row.id) ? row : event)); setLinkModalEvent(""); router.refresh(); }} /> : null}
      {gcalTask ? <TaskCalendarModal task={gcalTask} people={people} onClose={() => setGcalTask(null)} onSynced={(taskId) => setTaskRows((current) => current.map((row) => String(row.id) === taskId ? { ...row, gcal_added: true } : row))} /> : null}
    </div>
  );
}
